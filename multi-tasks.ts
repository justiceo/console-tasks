import { erase, cursor } from "sisteransi";
import color from "picocolors";
import isUnicodeSupported from "is-unicode-supported";
import { Writable } from "stream";

const unicode = isUnicodeSupported();
const s = (c: string, fallback: string) => (unicode ? c : fallback);
const S_STEP_ACTIVE = s("◆", "*");
const S_STEP_CANCEL = s("■", "x");
const S_STEP_ERROR = s("▲", "x");
const S_STEP_SUBMIT = s("◇", "o");

const frames = unicode ? ["◒", "◐", "◓", "◑"] : ["•", "o", "O", "0"];

/**
 * Represents a task to be executed by the MultiSpinner.
 */
export interface Task {
  /** The title of the task (or initial message set) */
  title: string;
  /** The function to execute for this task.
   * It takes one parameter: a function that is used to update the displayed message for this task.
   */
  task: (message: (msg: string) => void) => Promise<string | void>;
  /** Whether the task is enabled (default: true) */
  enabled?: boolean;
  /** Custom status symbol to display instead of the spinner */
  statusSymbol?: string;
}

interface Spinner {
  frame: number;
  message: string;
  status: "pending" | "success" | "error";
  statusSymbol?: string;
}

/**
 * Class for managing and displaying multiple concurrent tasks.
 */
export class MultiSpinner {
  private tasks: Task[];
  private spinners: Map<string, Spinner>;
  private interval: NodeJS.Timeout | null;
  private previousRenderedLines: number;
  private isRunning: boolean;
  private taskPromises: Promise<void>[];
  private resolveAllTasks: (() => void) | null;
  private stream: Writable;

  /**
   * Creates a new MultiSpinner instance.
   * @param tasks - An array of tasks to be executed
   * @param stream - The output stream to write to (default: process.stdout)
   */
  constructor(tasks: Task[], stream: Writable = process.stdout) {
    this.tasks = tasks;
    this.spinners = new Map();
    this.interval = null;
    this.previousRenderedLines = 0;
    this.isRunning = false;
    this.taskPromises = [];
    this.resolveAllTasks = null;
    this.stream = stream;

    this.initializeTasks(tasks);
  }

  private initializeTasks(tasks: Task[]): void {
    tasks.forEach((task, index) => {
      if (task.enabled !== false) {
        this.spinners.set(String(index), {
          frame: 0,
          message: task.title,
          status: "pending",
          statusSymbol: task.statusSymbol,
        });
      }
    });
  }

  /**
   * Starts the execution of tasks and renders the spinner.
   * @returns A promise that resolves when all tasks are completed
   */
  start(): Promise<void> {
    this.isRunning = true;
    this.stream.write("\n");
    this.render();
    this.interval = setInterval(() => this.render(), 80);

    return new Promise<void>((resolve) => {
      this.resolveAllTasks = resolve;
      this.tasks.forEach((task, index) => {
        this.taskPromises.push(this.executeTask(task, index));
      });
    });
  }

  /**
   * Stops the spinner and renders the final state.
   */
  stop(): void {
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.render();
    this.stream.write("\n");
  }

  /**
   * Updates the message for a specific task.
   * @param index - The index of the task to update
   * @param message - The new message to display
   */
  update(index: number, message: string) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.message = message;
    }
  }

  /**
   * Marks a task as succeeded.
   * @param index - The index of the task
   * @param message - Optional message to display
   */
  succeed(index: number, message?: string) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.status = "success";
      if (message) spinner.message = message;
    }
  }

  /**
   * Marks a task as failed.
   * @param index - The index of the task
   * @param message - Optional error message to display
   */
  fail(index: number, message?: string) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.status = "error";
      if (message) spinner.message = message;
    }
  }

  /**
   * Adds a new task to the spinner.
   * @param task - The task to add
   */
  addTask(task: Task): void {
    if (this.hasPendingTasks()) {
      const newIndex = this.spinners.size;
      this.spinners.set(String(newIndex), {
        frame: 0,
        message: task.title,
        status: "pending",
        statusSymbol: task.statusSymbol,
      });
      this.tasks.push(task);

      // If the spinner is already running, start the new task immediately
      if (this.isRunning) {
        this.taskPromises.push(this.executeTask(task, newIndex));
      }
    }
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

    try {
      const result = await task.task(updateMessage);
      this.succeed(index, result || task.title);
    } catch (error) {
      this.fail(index, `${task.title} (Error: ${(error as Error).message})`);
    }

    if (!this.hasPendingTasks() && this.resolveAllTasks) {
      this.render(); // Final call to render.
      this.resolveAllTasks();
    }
  }

  private render(): void {
    if (!this.isRunning) {
      return;
    }

    const output = Array.from(this.spinners.values())
      .map((spinner) => {
        const frame = frames[spinner.frame];
        spinner.frame = (spinner.frame + 1) % frames.length;
        const statusSymbol = spinner.statusSymbol
          ? spinner.statusSymbol
          : spinner.status === "success"
          ? S_STEP_SUBMIT
          : spinner.status === "error"
          ? S_STEP_ERROR
          : frame;
        return `${statusSymbol}  ${spinner.message}`;
      })
      .join("\n");

    // Clear previous lines
    if (this.previousRenderedLines > 0) {
      this.stream.write(erase.lines(this.previousRenderedLines));
    }
    this.stream.write(cursor.to(0, 0));
    this.stream.write(output);

    this.previousRenderedLines = output.split("\n").length;
  }
}

///// Tests /////
function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

function test() {
  const initialTasks: Task[] = [
    {
      title: "Task 1",
      task: async (message) => {
        await sleep(2);
        message("Task 1 is halfway done");
        await sleep(2);
        return "Task 1 completed successfully";
      },
    },
    {
      title: "Task 2",
      task: async (message) => {
        await sleep(1);
        message("Task 2 is progressing");
        await sleep(2);
        return "Task 2 finished";
      },
    },
  ];

  const multiSpinner = new MultiSpinner(initialTasks);

  // Start the spinner and get the promise
  const allTasksPromise = multiSpinner.start();

  // Add a new task after 1 second
  setTimeout(() => {
    multiSpinner.addTask({
      title: "Task 3 with custom symbol",
      statusSymbol: "!",
      task: async (message) => {
        await sleep(1);
        message("Task 3 is running");
        await sleep(2);
        return "Task 3 completed";
      },
    });
  }, 1000);

  // Add another task after 2 seconds
  setTimeout(() => {
    multiSpinner.addTask({
      title: "Task Alpha",
      task: async (message) => {
        await sleep(1);
        message("Task Alpha is executing");
        await sleep(1);
        throw new Error("Task Alpha failed");
      },
    });
  }, 2000);

  setTimeout(() => {
    multiSpinner.addTask({
      title: "Task Beta",
      task: async (message) => {
        await sleep(1);
        message("Task Beta is executing");
        await sleep(1);
        return "Task Beta done";
      },
    });
  }, 3500);

  // Add another task after 3 seconds
  setTimeout(() => {
    multiSpinner.addTask({
      title: "Task 4 (Added)",
      task: async (message) => {
        await sleep(1);
        message("Task 4 is executing");
        await sleep(1);
        return "Task 4 done";
      },
    });
  }, 3000);

  // Try to add a task after all tasks are completed (should have no effect)
  setTimeout(() => {
    multiSpinner.addTask({
      title: "Task 5 (Should not be added)",
      task: async (message) => {
        await sleep(1);
        return "This task should not run";
      },
    });
  }, 6000);

  // Wait for all tasks to complete
  allTasksPromise
    .then(() => {
      console.log("\nAll tasks completed!");
      multiSpinner.stop();
    })
    .catch((error) => {
      console.error("\nAn error occurred:", error);
      multiSpinner.stop();
    });
}
test();
