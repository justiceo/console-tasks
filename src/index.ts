import { erase, cursor } from "sisteransi";
import color from "picocolors";
import { Writable } from "node:stream";

// Export color for use in dependent modules.
export { color };

export interface StatusSymbol {
  pending: string | string[];
  // These symbols should be single characters to avoid visual confusion.
  success: string;
  error: string;
  cancelled: string;
}

const unicode = isUnicodeSupported();
const s = (c: string, fallback: string) => (unicode ? c : fallback);
const frames = unicode ? ["◒", "◐", "◓", "◑"] : ["•", "o", "O", "0"];
const defaultStatusSymbols: StatusSymbol = {
  pending: frames.map((frame) => color.magenta(frame)),
  success: color.green(s("◇", "o")),
  error: color.red(s("■", "x")),
  cancelled: color.yellow(s("▲", "x")),
};

export const UI_SYMBOLS = {
  INFO_STATUS: color.green(s("◇", "o")),
  ERROR_STATUS: color.red(s("■", "x")),
  WARN_STATUS: color.yellow(s("▲", "x")),
  BAR_START: s("┌", "T"),
  BAR: s("│", "|"),
  BAR_END: s("└", "—"),
  BAR_H: s("─", "-"),
  CORNER_TOP_RIGHT: s("┐", "+"),
  CONNECT_LEFT: s("├", "+"),
  CORNER_BOTTOM_RIGHT: s("┘", "+"),
};

/**
 * Represents a task to be executed by the TaskManager.
 */
export interface Task {
  /** The initial message to be displayed. */
  initialMessage: string;

  /**
   * The function to execute for this task.
   * @param updateFn Function to update the displayed message for this task.
   * @param signal AbortSignal to handle task cancellation.
   * @returns A Promise that resolves with a new Task or void.
   */
  task: (
    updateFn: (msg: string) => void,
    signal: AbortSignal
  ) => Promise<Task | void | any>;

  /** Whether the task is disabled (default: false) */
  disabled?: boolean;

  /** When true, the task is run but its UI is not rendered. */
  isHidden?: boolean;

  /** Custom status symbol to display instead of the spinner */
  statusSymbol?: string | Partial<StatusSymbol>;

  /** Optional index for positioning the task in the console output.
   * Indexes overwrite the existing task at that position if it exists.
   * Use carefully to avoid overlapping tasks.
   */
  index?: number;
}

type SpinnerStatus = "pending" | "success" | "error" | "cancelled";

class Spinner {
  frame: number;
  message: string;
  statusSymbol?: string | Partial<StatusSymbol>;
  isHidden?: boolean;
  private _status: SpinnerStatus;
  private statusChangeHandlers: ((
    newStatus: SpinnerStatus,
    data?: any
  ) => void)[] = [];
  private _data?: any;

  constructor(
    initialMessage: string,
    initialStatus: SpinnerStatus = "pending"
  ) {
    this.frame = 0;
    this.message = initialMessage;
    this._status = initialStatus;
  }

  get status(): SpinnerStatus {
    return this._status;
  }

  set status(newStatus: SpinnerStatus) {
    if (this._status !== newStatus) {
      this._status = newStatus;
      this.statusChangeHandlers.forEach((handler) =>
        handler(newStatus, this._data)
      );
    }
  }

  setStatusWithData(newStatus: SpinnerStatus, data?: any) {
    this._data = data;
    this.status = newStatus;
  }

  onStatusChange(
    handler: (newStatus: SpinnerStatus, data?: any) => void
  ): void {
    this.statusChangeHandlers.push(handler);
  }
}

export interface TaskManagerOptions {
  stream?: Writable;
  title?: string;
  customStatusSymbols?: Partial<StatusSymbol>;
  keepAlive?: boolean;
  taskPrefix?: (taskSeparator: string, statusSymbol: string) => string;
  stopAndRecreate?: boolean;
  headerFormatter?: (title: string) => string;
  enableDebug?: boolean;
}

export class TaskManager {
  private static instance?: TaskManager = null;
  private static hasRenderedTitle = false;
  private tasks: Task[] = [];
  private spinners: Map<number, Spinner> = new Map();
  private interval?: NodeJS.Timeout = null;
  private previousRenderedLines = 0;
  private isRunning = false;
  // An array of promises for each task.
  private taskPromises: Promise<void>[] = [];
  // A promise that resolves when all pending tasks are completed.
  private isIdlePromise: Promise<void>;
  private resolveAllTasks: (() => void) | null = null;
  private readonly stream: Writable;
  private rows: number;
  private abortController: AbortController;
  private title?: string;
  private readonly statusSymbols: StatusSymbol;
  private keepAlive: boolean;
  private taskPrefix: (taskSeparator: string, statusSymbol: string) => string;
  private headerFormatter: (title: string) => string;
  private isCursorHidden: boolean = false;

  private constructor(options: TaskManagerOptions) {
    this.stream = options.stream || process.stdout;
    this.title = options.title;
    this.rows = (this.stream as any).rows || 0;
    this.statusSymbols = {
      ...defaultStatusSymbols,
      ...options.customStatusSymbols,
    };
    this.keepAlive = options.keepAlive || false;
    this.taskPrefix =
      options.taskPrefix ??
      ((separator, symbol) => `${separator}\n${symbol}  `);
    this.headerFormatter =
      options.headerFormatter ??
      ((title) =>
        title ? `${UI_SYMBOLS.BAR_START} ${color.inverse(title)}\n` : "");

    this.stream.on("resize", () => {
      this.rows = (this.stream as any).rows || 0;
    });

    this.reset();

    if (this.keepAlive) {
      this.run(new KeepAlive());
    }
  }

  static getInstance(options: TaskManagerOptions = {}): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager(options);
    } else if (options?.stopAndRecreate) {
      TaskManager.instance.stop();
      TaskManager.instance = new TaskManager(options);
    }
    return TaskManager.instance;
  }

  /**
   * Resets the internal state of the TaskManager.
   */
  private reset(): void {
    this.tasks = [];
    this.spinners = new Map();
    this.taskPromises = [];
    this.previousRenderedLines = 0;
    this.abortController = new AbortController();
    this.isIdlePromise = new Promise((resolve) => {
      this.resolveAllTasks = resolve;
    });
  }

  /**
   * Waits for all tasks to complete.
   * @returns A promise that resolves when all tasks are completed
   */
  idle(): Promise<void> {
    return this.isIdlePromise;
  }

  /**
   * Starts rendering the tasks.
   */
  private startRendering(): void {
    this.isRunning = true;
    this.hideCursor();
    this.render();
    this.interval = setInterval(() => this.render(), 80);

    // Set up Ctrl+C handler
    process.once("SIGINT", () => {
      this.stop();
    });
  }

  /**
   * Stops the spinner and renders the final state.
   */
  stop(): void {
    if (!this.isRunning) return;

    this.cancelPendingTasks();
    this.render(); // Final render
    this.stopRendering();
    this.reset();
  }

  /**
   * Stops the rendering process.
   */
  private stopRendering(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.isRunning = false;
    this.showCursor();
    this.stream.write("\n");
  }

  /**
   * Hides the cursor.
   */
  private hideCursor(): void {
    if (!this.isCursorHidden) {
      this.stream.write(cursor.hide);
      this.isCursorHidden = true;
    }
  }

  /**
   * Shows the cursor.
   */
  private showCursor(): void {
    if (this.isCursorHidden) {
      this.stream.write(cursor.show);
      this.isCursorHidden = false;
    }
  }

  /**
   * Cancels all pending tasks.
   */
  private cancelPendingTasks(): void {
    this.spinners.forEach((spinner) => {
      if (spinner.status === "pending") {
        spinner.status = "cancelled";
        spinner.message += " (Cancelled)";
      }
    });
    this.abortController.abort();
  }

  /**
   * Updates the message for a specific task.
   * @param index - The index of the task to update
   * @param message - The new message to display
   */
  update(index: number, message: string): void {
    const spinner = this.spinners.get(index);
    if (spinner) {
      spinner.message = message;
    }
  }

  /**
   * Adds new tasks to the TaskManager and starts executing them immediately.
   * @param tasks - The tasks to add and execute
   * @returns An array of task IDs
   */
  run(...tasks: Task[]): number[] {
    if (!this.isRunning) {
      this.reset();
    }

    const taskIds = [];
    tasks.forEach((task) => {
      if (task.disabled) return;

      const newIndex = task.index ?? this.spinners.size;
      const spinner = new Spinner(task.initialMessage);
      spinner.statusSymbol = task.statusSymbol;
      spinner.isHidden = task.isHidden;
      this.spinners.set(newIndex, spinner);
      this.tasks.push(task);
      taskIds.push(newIndex);

      // Start the task immediately
      this.taskPromises.push(this.executeTask(task, newIndex));
    });

    // Start rendering if not already running
    if (!this.isRunning) {
      this.startRendering();
    }

    return taskIds;
  }

  /**
   * Registers a handler for status changes of a specific task.
   * @param index The index of the task
   * @param handler The handler to call when the status changes
   */
  onStatusChange(
    index: number,
    handler: (newStatus: SpinnerStatus, data?: any) => void
  ): void {
    const spinner = this.spinners.get(index);
    if (spinner) {
      spinner.onStatusChange(handler);
    }
  }
  /**
   * Checks if there are any pending tasks.
   * @returns True if there are pending tasks, false otherwise
   */
  private hasPendingTasks(): boolean {
    return Array.from(this.spinners.values()).some(
      (spinner) => spinner.status === "pending"
    );
  }

  /**
   * Executes a single task.
   * @param task - The task to execute
   * @param index - The index of the task
   */
  private async executeTask(task: Task, index: number): Promise<void> {
    const updateMessage = (message: string) => {
      this.update(index, message);
    };

    const spinner = this.spinners.get(index);
    if (!spinner) return;

    try {
      const result = await task.task(
        updateMessage,
        this.abortController.signal
      );
      if (this.abortController.signal.aborted) {
        return;
      }

      // Queue the next task if it's returned from the current task
      if (result && typeof result === "object" && "task" in result) {
        this.run(result);
      }
      spinner.setStatusWithData("success", result);
    } catch (error) {
      spinner.setStatusWithData("error", error);
    }

    if (!this.hasPendingTasks()) {
      this.resolveAllTasks?.();
      // Stop and reset for potential reuse
      this.stop();
      // When we return, avoid re-rendering the title.
      TaskManager.hasRenderedTitle = true;
    }
  }

  /**
   * Renders the current state of all tasks.
   */
  private render(): void {
    if (!this.isRunning) return;

    // Ensure cursor is hidden before rendering
    this.hideCursor();

    // Preserve rendering task and filter out hidden tasks.
    const sortedSpinners = Array.from(this.spinners.entries())
      .filter(([index, spinner]) => !spinner.isHidden)
      .sort(([a], [b]) => a - b);

    const header = !TaskManager.hasRenderedTitle
      ? this.headerFormatter(this.title)
      : "";
    const output =
      header +
      sortedSpinners
        .map(([_, spinner]) => {
          const statusSymbol = this.getStatusSymbol(spinner);
          return `${this.taskPrefix(UI_SYMBOLS.BAR, statusSymbol)}${
            spinner.message
          }`;
        })
        .join("\n");

    // Clear previous lines
    if (this.previousRenderedLines > 0) {
      this.stream.write(erase.lines(this.previousRenderedLines));
    }
    // When the screen height is less than the lines written, only the visible lines are cleared.
    // Writing more than the visible lines (rows) afterwards causes the unclear content earlier to be repeated.
    this.stream.write(cursor.to(0, 0));
    const currentOutputLines = output.split("\n").length;
    if (currentOutputLines <= this.rows) {
      this.stream.write(output);
    } else {
      this.stream.write(
        output
          .split("\n")
          .slice(currentOutputLines - this.rows)
          .join("\n")
      );
    }
    this.previousRenderedLines = currentOutputLines;
  }

  /**
   * Gets the appropriate status symbol for a spinner.
   * @param spinner - The spinner to get the status symbol for
   * @returns The status symbol as a string
   */
  private getStatusSymbol(spinner: Spinner): string {
    if (typeof spinner.statusSymbol === "string") {
      return spinner.statusSymbol;
    }
    if (spinner.status === "pending") {
      const pendingSymbol = this.statusSymbols.pending;
      if (Array.isArray(pendingSymbol)) {
        spinner.frame = (spinner.frame + 1) % pendingSymbol.length;
        return pendingSymbol[spinner.frame];
      }
      return pendingSymbol;
    } else {
      return this.statusSymbols[spinner.status];
    }
  }
}

export class BaseTask implements Task {
  initialMessage: string;
  updateFn: (msg: string) => void = () => {};
  signal?: AbortSignal;
  close: (value: Task | void | {}) => void = () => {};
  fail: (error: string | Error) => void = () => {};

  constructor(title = "") {
    this.initialMessage = title;
  }

  // Defers initialization to the derived class, after the task is started.
  initialize() {}

  // Hook for subclasses to perform cleanup before closing the task.
  beforeClose(value: Task | void | {}) {}

  task: Task["task"] = async (updateFn, signal) => {
    this.updateFn = updateFn;
    this.signal = signal;
    this.initialize();
    // Check if the task was aborted before starting.
    if (signal?.aborted) return;

    const abortHandler = () => {
      this.close();
    };
    signal.addEventListener("abort", abortHandler, { once: true });

    try {
      return await new Promise<Task | void>((resolve, reject) => {
        if (signal.aborted) {
          resolve();
          return;
        }

        this.close = (result) => {
          this.beforeClose(result);
          resolve(result as void);
        };
        this.fail = reject;
      });
    } finally {
      signal.removeEventListener("abort", abortHandler);
    }
  };
}

export class KeepAlive extends BaseTask {
  isHidden = true;
}

/**
 * Adds a simple message task to the TaskManager.
 * @param msg - The message to display
 */
export const addMessage = (msg: string, statusSymbol?: string): void => {
  TaskManager.getInstance().run({
    statusSymbol: statusSymbol,
    initialMessage: msg,
    task: async () => {},
  });
};

/**
 * Converts a function into a task and executes it.
 * @param fn The function to execute as a task.
 * @param title An optional title for the task.
 * @returns A promise that resolves when the task is completed.
 */
export const taskify = async <T>(
  fn: () => Promise<T>,
  title: string = "Task"
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const task: Task = {
      initialMessage: title,
      task: async (updateFn, signal) => {
        try {
          const result = await fn();
          return result;
        } catch (error) {
          updateFn(`${title} failed: ${error.message}`);
          throw error;
        }
      },
    };

    const taskManager = TaskManager.getInstance();
    const [taskId] = taskManager.run(task);

    taskManager.onStatusChange(taskId, (newStatus, data) => {
      if (newStatus === "success") {
        resolve(data);
      } else if (newStatus === "error") {
        reject(data);
      }
    });
  });
};

/**
 * Creates a task that executes a sequence of tasks.
 * @param tasks The tasks to execute in sequence.
 * @returns A new Task that represents the sequence of tasks.
 */
export const sequence = (...tasks: Task[]): Task => {
  tasks.forEach((task, i) => {
    const origTaskFn = task.task;
    task.task = async (updateFn, signal) => {
      const result = await origTaskFn(updateFn, signal);

      // If the result is a task, insert it into the sequence.
      if (result && typeof result === "object" && "task" in result) {
        tasks.splice(i + 1, 0, result);
      }

      return result;
    };
  });

  // Return the first task in the sequence.
  return tasks[0];
};

/**
 * Checks if Unicode is supported in the current environment.
 * From https://www.npmjs.com/package/is-unicode-supported
 * @returns True if Unicode is supported, false otherwise.
 */
export function isUnicodeSupported(): boolean {
  if (process.platform !== "win32") {
    return process.env.TERM !== "linux"; // Linux console (kernel)
  }

  const env = process.env;
  return Boolean(
    env.WT_SESSION || // Windows Terminal
      env.TERMINUS_SUBLIME || // Terminus (<0.2.27)
      env.ConEmuTask === "{cmd::Cmder}" || // ConEmu and cmder
      env.TERM_PROGRAM === "Terminus-Sublime" ||
      env.TERM_PROGRAM === "vscode" ||
      env.TERM === "xterm-256color" ||
      env.TERM === "alacritty" ||
      env.TERMINAL_EMULATOR === "JetBrains-JediTerm"
  );
}

/**
 * Regular expression for matching ANSI escape codes.
 * Adapted from https://github.com/chalk/ansi-regex
 * @see LICENSE
 */
export function ansiRegex() {
  const pattern = [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))",
  ].join("|");

  return new RegExp(pattern, "g");
}

/**
 * Strips ANSI escape codes from a string.
 * @param str The string to strip.
 * @returns The string without ANSI escape codes.
 */
export const strip = (str: string) => str.replace(ansiRegex(), "");
