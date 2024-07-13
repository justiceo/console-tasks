import { erase, cursor } from "sisteransi";
import color from "picocolors";
import isUnicodeSupported from "is-unicode-supported";
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
  error: color.red(s("▲", "x")),
  cancelled: color.yellow(s("■", "x")),
};

/**
 * Represents a task to be executed by the TaskManager.
 */
export interface Task {
  /** The initial message to be displayed. */
  initialMessage: string;
  /** The function to execute for this task.
   * It takes one parameter: a function that is used to update the displayed message for this task.
   */
  task: (
    updateFn: (msg: string) => void,
    signal: AbortSignal
  ) => Promise<string | void>;
  /** Whether the task is disabled (default: false) */
  disabled?: boolean;
  /** Custom status symbol to display instead of the spinner */
  statusSymbol?: string | StatusSymbol;
  /** Optional index for positioning the task in the console output.
   * Indexes overwrite the existing task at that position if it exists.
   * Use carefully to avoid overlapping tasks.
   */
  index?: number;
}

interface Spinner {
  frame: number;
  message: string;
  status: "pending" | "success" | "error" | "cancelled";
  statusSymbol?: string | StatusSymbol;
}

export class TaskManager {
  private static instance: TaskManager;
  private tasks: Task[];
  private spinners: Map<number, Spinner>;
  private interval: NodeJS.Timeout | null;
  private previousRenderedLines: number;
  private isRunning: boolean;
  private taskPromises: Promise<void>[];
  private resolveAllTasks: (() => void) | null;
  private stream: Writable;
  private rows: number;
  private abortController: AbortController;
  private statusSymbols: StatusSymbol;

  /**
   * Creates a new TaskManager instance.
   * @param stream - The output stream to write to (default: process.stdout)
   * @param customStatusSymbols - Custom status symbols to use (optional)
   */
  constructor(
    stream: Writable = process.stdout,
    customStatusSymbols?: Partial<StatusSymbol>
  ) {
    this.tasks = [];
    this.spinners = new Map();
    this.interval = null;
    this.previousRenderedLines = 0;
    this.isRunning = false;
    this.taskPromises = [];
    this.resolveAllTasks = null;
    this.stream = stream;
    this.rows = stream.rows || 0;
    this.abortController = new AbortController();
    this.statusSymbols = { ...defaultStatusSymbols, ...customStatusSymbols };

    stream.on("resize", () => {
      this.rows = stream.rows! || 0;
    });
  }

  static getInstance(
    stream?: Writable,
    customStatusSymbols?: Partial<StatusSymbol>
  ) {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager(stream, customStatusSymbols);
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
        const index = task.index !== undefined ? task.index : defaultIndex;
        this.taskPromises.push(this.executeTask(task, index));
      });
    });

    // Clear the interval for rendering when all tasks are completed.
    allPromises.finally(() => {
      this.stop();
    });

    // Set up Ctrl+C handler
    process.on("SIGINT", () => {
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
    this.isRunning = false; // Turns off rendering.
    this.abortController.abort();
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.stream.write("\n");
    if (this.resolveAllTasks) {
      this.resolveAllTasks();
    }
  }

  cancelPendingTasks(): void {
    this.spinners.forEach((spinner, index) => {
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
  update(index: number, message: string) {
    const spinner = this.spinners.get(index);
    if (spinner) {
      spinner.message = message;
    }
  }

  /**
   * Adds a new task to the spinner.
   * @param task - The task to add
   */
  add(...tasks: Task[]): void {
    tasks.forEach((task) => {
      if (task.disabled) return;

      const newIndex =
        task.index !== undefined ? task.index : this.spinners.size;
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

  private hasPendingTasks(): boolean {
    return Array.from(this.spinners.values()).some(
      (spinner) => spinner.status === "pending"
    );
  }

  private async executeTask(task: Task, index: number): Promise<void> {
    const updateMessage = (message: string) => {
      this.update(index, message);
    };

    const spinner = this.spinners.get(index);
    if (!spinner) {
      // This should never happen.
      return;
    }

    try {
      await task.task(updateMessage, this.abortController.signal);
      if (!this.abortController.signal.aborted) {
        spinner.status = "success";
      }
    } catch (error) {
      spinner.status = "error";
    }

    if (!this.hasPendingTasks() && this.resolveAllTasks) {
      this.render(); // ? TODO: Is this call necessary?
      this.resolveAllTasks();
    }
  }

  private render(): void {
    if (!this.isRunning) {
      return;
    }

    const sortedSpinners = Array.from(this.spinners.entries()).sort(
      ([a], [b]) => a - b
    );

    const output = sortedSpinners
      .map(([_, spinner]) => {
        let statusSymbol: string;
        if (typeof spinner.statusSymbol === "string") {
          statusSymbol = spinner.statusSymbol;
        } else {
          statusSymbol = this.getStatusSymbol(spinner);
        }

        return `|\n${statusSymbol}  ${spinner.message}`;
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

  private getStatusSymbol(spinner: Spinner): string {
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
  updateFn: any = () => {};
  signal?: AbortSignal;
  close: (reason?: string) => void;
  fail: (error: string | Error) => void;

  constructor(title?: string) {
    this.initialMessage = title ?? "";
  }

  task: (
    updateFn: (msg: string) => void,
    signal: AbortSignal
  ) => Promise<string | void> = async (updateFn, signal) => {
    this.updateFn = updateFn;
    this.signal = signal;

    // Check if the task was aborted before starting.
    if (signal?.aborted) return Promise.resolve("Aborted");

    const abortHandler = () => {
      this.close("Aborted"); // Resolve instead of reject to avoid unhandled promise rejection.
    };
    signal.addEventListener("abort", abortHandler, { once: true });

    const p = new Promise<string | void>((resolve, reject) => {
      if (signal.aborted) {
        resolve(); // Resolve immediately if already aborted
        return;
      }

      this.close = resolve;
      this.fail = reject;
    });
    p.finally(() => {
      signal.removeEventListener("abort", abortHandler);
    });
    return p;
  };
}

export const addMessage = (msg: string) => {
  TaskManager.getInstance().add({
    initialMessage: msg,
    task: async () => {},
  });
};
