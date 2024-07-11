import { erase, cursor } from 'sisteransi';
import color from 'picocolors';
import isUnicodeSupported from 'is-unicode-supported';

const unicode = isUnicodeSupported();
const s = (c: string, fallback: string) => (unicode ? c : fallback);
const S_STEP_ACTIVE = s('◆', '*');
const S_STEP_CANCEL = s('■', 'x');
const S_STEP_ERROR = s('▲', 'x');
const S_STEP_SUBMIT = s('◇', 'o');

const frames = unicode ? ['◒', '◐', '◓', '◑'] : ['•', 'o', 'O', '0'];

export interface Task {
  title: string;
  task: (message: (msg: string) => void) => Promise<string | void>;
  enabled?: boolean;
}

interface Spinner {
  frame: number;
  message: string;
  status: "pending" | "success" | "error";
}

export class MultiSpinner {
  private tasks: Task[];
  private spinners: Map<string, Spinner>;
  private interval: NodeJS.Timeout | null;
  private previousRenderedLines: number;
  private isRunning: boolean;
  private taskPromises: Promise<void>[];
  private resolveAllTasks: (() => void) | null;

  constructor(tasks: Task[]) {
    this.tasks = tasks;
    this.spinners = new Map();
    this.interval = null;
    this.previousRenderedLines = 0;
    this.isRunning = false;
    this.taskPromises = [];
    this.resolveAllTasks = null;

    this.initializeTasks(tasks);
  }

  private initializeTasks(tasks: Task[]): void {
    tasks.forEach((task, index) => {
      if (task.enabled !== false) {
        this.spinners.set(String(index), {
          frame: 0,
          message: task.title,
          status: "pending",
        });
      }
    });
  }

  start(): Promise<void> {
    this.isRunning = true;
    process.stdout.write("\n");
    this.render();
    this.interval = setInterval(() => this.render(), 80);

    return new Promise<void>((resolve) => {
      this.resolveAllTasks = resolve;
      this.tasks.forEach((task, index) => {
        this.taskPromises.push(this.executeTask(task, index));
      });
    });
  }

  stop(): void {
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.render();
    process.stdout.write("\n");
  }

  update(index: number, message: string) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.message = message;
    }
  }

  succeed(index: number, message?: string) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.status = "success";
      if (message) spinner.message = message;
    }
  }

  fail(index: number, message?: string) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.status = "error";
      if (message) spinner.message = message;
    }
  }

  addTask(task: Task): void {
    if (this.hasPendingTasks()) {
      const newIndex = this.spinners.size;
      this.spinners.set(String(newIndex), {
        frame: 0,
        message: task.title,
        status: "pending",
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

  async executeTask(task: Task, index: number): Promise<void> {
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
        const statusSymbol =
          spinner.status === "success" ? S_STEP_SUBMIT : spinner.status === "error" ? S_STEP_ERROR : frame;
        return `${statusSymbol}  ${spinner.message}`;
      })
      .join("\n");
  
    // Clear previous lines
    if (this.previousRenderedLines > 0) {
      process.stdout.write(erase.lines(this.previousRenderedLines));
    }
    process.stdout.write(cursor.to(0, 0));
    process.stdout.write(output);
  
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
      title: "Task 3 (Added)",
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
