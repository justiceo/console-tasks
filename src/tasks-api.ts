import { erase, cursor } from "sisteransi";
import color from "picocolors";
import { Writable } from "stream";

export interface StatusSymbol {
  pending: string | string[];
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
  BAR_START: s('┌', 'T'),
  BAR: s('│', '|'),
  BAR_END: s('└', '—'),
  BAR_H: s('─', '-'),
  CORNER_TOP_RIGHT: s('┐', '+'),
  CONNECT_LEFT: s('├', '+'),
  CORNER_BOTTOM_RIGHT: s('┘', '+'),
}

/**
 * Represents a task to be executed by the TaskManager.
 */
export interface Task {
  /** The initial message to be displayed. */
  initialMessage: string;

  /** The function to execute for this task.
   * @param updateFn Function to update the displayed message for this task.
   * @param signal AbortSignal to handle task cancellation.
   * @returns A Promise that resolves with a new Task or void.
   */
  task: (
    updateFn: (msg: string) => void,
    signal: AbortSignal
  ) => Promise<Task | void>;

  /** Whether the task is disabled (default: false) */
  disabled?: boolean;

  /** When true, the task is run but its UI is not rendered. */
  // TODO: Implement this.
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

interface Spinner {
  frame: number;
  message: string;
  status: SpinnerStatus;
  statusSymbol?: string | Partial<StatusSymbol>;
}

export class TaskManager {
  private static instance?: TaskManager = null;
  private tasks: Task[] = [];
  private spinners: Map<number, Spinner> = new Map();
  private interval?: NodeJS.Timeout = null;
  private previousRenderedLines = 0;
  private isRunning = false;
  private taskPromises: Promise<void>[] = [];
  private resolveAllTasks: (() => void) | null = null;
  private readonly stream: Writable;
  private rows: number;
  private abortController: AbortController;
  private title?: string;
  private readonly statusSymbols: StatusSymbol;
  private header = `${UI_SYMBOLS.BAR_START} ${color.bgCyan(color.bold(this.title))}\n`

  /**
   * Creates a new TaskManager instance.
   * @param stream - The output stream to write to (default: process.stdout)
   * @param customStatusSymbols - Custom status symbols to use (optional)
   */
  // TODO: Add keepAlive as an option, which insides a hidden KeepAlive task.
  // TODO: Move this params to an options object.
  private constructor(
    stream: Writable = process.stdout,
    title?: string,
    customStatusSymbols?: Partial<StatusSymbol>
  ) {
    this.stream = stream;
    this.title = title;
    this.rows = (stream as any).rows || 0;
    this.abortController = new AbortController();
    this.statusSymbols = { ...defaultStatusSymbols, ...customStatusSymbols };

    stream.on("resize", () => {
      this.rows = (stream as any).rows || 0;
    });
  }

  /**
   * Gets the singleton instance of TaskManager.
   * @param stream - The output stream to write to (default: process.stdout)
   * @param customStatusSymbols - Custom status symbols to use (optional)
   */
  static getInstance(
    stream?: Writable,
    title?: string,
    customStatusSymbols?: Partial<StatusSymbol>
  ): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager(stream, title, customStatusSymbols);
    }
    return TaskManager.instance;
  }

  /**
   * Starts the execution of tasks and renders the spinner.
   * @returns A promise that resolves when all tasks are completed
   */
  run(): Promise<void> {
    this.isRunning = true;
    this.stream.write("\n");
    this.render();
    this.interval = setInterval(() => this.render(), 80);

    const allPromises = new Promise<void>((resolve) => {
      this.resolveAllTasks = resolve;
      this.tasks.forEach((task, defaultIndex) => {
        const index = task.index ?? defaultIndex;
        this.taskPromises.push(this.executeTask(task, index));
      });
    });

    // Clear the interval for rendering when all tasks are completed.
    allPromises.finally(() => {
      this.stop();
    });

    // Set up Ctrl+C handler
    process.once("SIGINT", () => {
      this.stop();
    });

    return allPromises;
  }

  /**
   * Stops the spinner and renders the final state.
   */
  stop(): void {
    if (!this.isRunning) return;

    this.cancelPendingTasks();
    this.render();
    this.isRunning = false;
    this.abortController.abort();
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.stream.write("\n");
    this.resolveAllTasks?.();
    this.resolveAllTasks = null;
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
   * Adds new tasks to the TaskManager.
   * @param tasks - The tasks to add
   */
  add(...tasks: Task[]): void {
    tasks.forEach((task) => {
      if (task.disabled) return;

      const newIndex = task.index ?? this.spinners.size;
      this.spinners.set(newIndex, {
        frame: 0,
        message: task.initialMessage,
        status: "pending",
        statusSymbol: task.statusSymbol,
      });
      this.tasks.push(task);

      // If the spinner is already running, start the new task immediately
      if (this.isRunning) {
        this.taskPromises.push(this.executeTask(task, newIndex));
      }
    });
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
        this.add(result);
      }
      spinner.status = "success";
    } catch (error) {
      spinner.status = "error";
    }

    if (!this.hasPendingTasks()) {
      this.resolveAllTasks?.();
    }
  }

  /**
   * Renders the current state of all tasks.
   */
  private render(): void {
    if (!this.isRunning) return;

    const sortedSpinners = Array.from(this.spinners.entries()).sort(
      ([a], [b]) => a - b
    );

    const header = this.title ? this.header : "";
    const output = header + sortedSpinners
      .map(([_, spinner]) => {
        const statusSymbol = this.getStatusSymbol(spinner);
        return `${UI_SYMBOLS.BAR}\n${statusSymbol}  ${spinner.message}`;
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
  close: (value: Task | void) => void = () => {};
  fail: (error: string | Error) => void = () => {};

  constructor(title = "") {
    this.initialMessage = title;
  }

  task: Task["task"] = async (updateFn, signal) => {
    this.updateFn = updateFn;
    this.signal = signal;
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

        this.close = resolve;
        this.fail = reject;
      });
    } finally {
      signal.removeEventListener("abort", abortHandler);
    }
  };
}

/**
 * Adds a simple message task to the TaskManager.
 * @param msg - The message to display
 */
export const addMessage = (msg: string, statusSymbol?: string): void => {
  TaskManager.getInstance().add({
    statusSymbol: statusSymbol,
    initialMessage: msg,
    task: async () => {},
  });
};

/**
 * Chains the given tasks for sequential execution.
 * @param tasks - The tasks to execute in sequence
 * @returns A new Task that represents the sequence of tasks
 */
export const sequence = (...tasks: Task[]): Task => {
  // Chain all the tasks in sequence.
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const origTaskFn = task.task;
    task.task = (updateFn, signal) => {
      return new Promise(async (resolve) => {
        const result = await origTaskFn(updateFn, signal);

        // if the result is a task, insert it into the sequence.
        if (result instanceof Object && "task" in result) {
          tasks.splice(i + 1, 0, result);
        }

        // Resolve the current task with the next task in the sequence.
        if (i === tasks.length - 1) {
          resolve();
        } else {
          resolve(tasks[i + 1]);
        }
      });
    };
  }

  // Return the first task in the sequence.
  return tasks[0];
};

/**
 * Checks if Unicode is supported in the current environment.
 * From https://www.npmjs.com/package/is-unicode-supported
 * @returns True if Unicode is supported, false otherwise
 */
function isUnicodeSupported(): boolean {
  if (process.platform !== "win32") {
    return process.env.TERM !== "linux"; // Linux console (kernel)
  }

  return (
    Boolean(process.env.WT_SESSION) || // Windows Terminal
    Boolean(process.env.TERMINUS_SUBLIME) || // Terminus (<0.2.27)
    process.env.ConEmuTask === "{cmd::Cmder}" || // ConEmu and cmder
    process.env.TERM_PROGRAM === "Terminus-Sublime" ||
    process.env.TERM_PROGRAM === "vscode" ||
    process.env.TERM === "xterm-256color" ||
    process.env.TERM === "alacritty" ||
    process.env.TERMINAL_EMULATOR === "JetBrains-JediTerm"
  );
}

// Adapted from https://github.com/chalk/ansi-regex
// @see LICENSE
function ansiRegex() {
	const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
	].join('|');

	return new RegExp(pattern, 'g');
}
export const strip = (str: string) => str.replace(ansiRegex(), '');