import { erase, cursor } from "sisteransi";
import color from "picocolors";
import { Writable } from "node:stream";
import { isUnicodeSupported } from "./utils";

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

  /** Custom separator to use before this task's status symbol */
  taskSeparator?: string;

  contentPadding?: string;

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
  taskSeparator?: string;
  contentPadding?: string;
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
  taskSeparator?: string;
  contentPadding?: string;
  taskPrefix?: (
    taskSeparator: string,
    statusSymbol: string,
    contentPadding: string
  ) => string;
  stopAndRecreate?: boolean;
  headerFormatter?: (title: string) => string;
  enableDebug?: boolean;
  renderIntervalMs?: number;
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
  private defaultTaskSeparator: string;
  private defaultContentPadding: string;
  private taskPrefix: (
    taskSeparator: string,
    statusSymbol: string,
    contentPadding: string
  ) => string;
  private headerFormatter: (title: string) => string;
  private isCursorHidden: boolean = false;
  private renderIntervalMs: number = 80;

  private constructor(options: TaskManagerOptions) {
    this.stream = options.stream || process.stdout;
    this.title = options.title;
    this.rows = (this.stream as any).rows || 0;
    this.statusSymbols = {
      ...defaultStatusSymbols,
      ...options.customStatusSymbols,
    };
    this.keepAlive = options.keepAlive || false;
    this.defaultTaskSeparator = options.taskSeparator ?? UI_SYMBOLS.BAR + "\n";
    this.defaultContentPadding = options.contentPadding ?? "  ";
    this.taskPrefix =
      options.taskPrefix ??
      ((separator, symbol, contentPadding) =>
        `${separator}${symbol}${contentPadding}`);
    this.headerFormatter =
      options.headerFormatter ??
      ((title) =>
        title ? `${UI_SYMBOLS.BAR_START} ${color.inverse(title)}\n` : "");

    this.stream.on("resize", () => {
      this.rows = (this.stream as any).rows || 0;
    });

    if (options.renderIntervalMs) {
      this.renderIntervalMs = options.renderIntervalMs;
    }

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
    this.render();
    this.interval = setInterval(() => this.render(), this.renderIntervalMs);

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
      spinner.contentPadding =
        task.contentPadding ?? this.defaultContentPadding;
      spinner.taskSeparator = task.taskSeparator ?? this.defaultTaskSeparator;
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

    // Preserve rendering task order and filter out hidden tasks.
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
          const contentPadding =
            spinner.contentPadding ?? this.defaultContentPadding;
          return `${this.taskPrefix(
            spinner.taskSeparator,
            statusSymbol,
            contentPadding
          )}${spinner.message}`;
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
  index: number;
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
