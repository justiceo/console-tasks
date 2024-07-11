import { erase, cursor } from "sisteransi";
import isUnicodeSupported from "is-unicode-supported";
const unicode = isUnicodeSupported();
const s = (c, fallback) => unicode ? c : fallback;
const S_STEP_ACTIVE = s("\u25C6", "*");
const S_STEP_CANCEL = s("\u25A0", "x");
const S_STEP_ERROR = s("\u25B2", "x");
const S_STEP_SUBMIT = s("\u25C7", "o");
const frames = unicode ? ["\u25D2", "\u25D0", "\u25D3", "\u25D1"] : ["\u2022", "o", "O", "0"];
export class MultiSpinner {
  tasks;
  spinners;
  interval;
  previousRenderedLines;
  isRunning;
  taskPromises;
  resolveAllTasks;
  stream;
  /**
   * Creates a new MultiSpinner instance.
   * @param tasks - An array of tasks to be executed
   * @param stream - The output stream to write to (default: process.stdout)
   */
  constructor(tasks, stream = process.stdout) {
    this.tasks = tasks;
    this.spinners = /* @__PURE__ */ new Map();
    this.interval = null;
    this.previousRenderedLines = 0;
    this.isRunning = false;
    this.taskPromises = [];
    this.resolveAllTasks = null;
    this.stream = stream;
    this.initializeTasks(tasks);
  }
  initializeTasks(tasks) {
    tasks.forEach((task, index) => {
      if (task.enabled !== false) {
        this.spinners.set(String(index), {
          frame: 0,
          message: task.title,
          status: "pending",
          statusSymbol: task.statusSymbol
        });
      }
    });
  }
  /**
   * Starts the execution of tasks and renders the spinner.
   * @returns A promise that resolves when all tasks are completed
   */
  start() {
    this.isRunning = true;
    this.stream.write("\n");
    this.render();
    this.interval = setInterval(() => this.render(), 80);
    return new Promise((resolve) => {
      this.resolveAllTasks = resolve;
      this.tasks.forEach((task, index) => {
        this.taskPromises.push(this.executeTask(task, index));
      });
    });
  }
  /**
   * Stops the spinner and renders the final state.
   */
  stop() {
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
  update(index, message) {
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
  succeed(index, message) {
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
  fail(index, message) {
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
  addTask(task) {
    if (this.hasPendingTasks()) {
      const newIndex = this.spinners.size;
      this.spinners.set(String(newIndex), {
        frame: 0,
        message: task.title,
        status: "pending",
        statusSymbol: task.statusSymbol
      });
      this.tasks.push(task);
      if (this.isRunning) {
        this.taskPromises.push(this.executeTask(task, newIndex));
      }
    }
  }
  hasPendingTasks() {
    return Array.from(this.spinners.values()).some(
      (spinner) => spinner.status === "pending"
    );
  }
  async executeTask(task, index) {
    const updateMessage = (message) => {
      this.update(index, message);
    };
    try {
      const result = await task.task(updateMessage);
      this.succeed(index, result || task.title);
    } catch (error) {
      this.fail(index, `${task.title} (Error: ${error.message})`);
    }
    if (!this.hasPendingTasks() && this.resolveAllTasks) {
      this.render();
      this.resolveAllTasks();
    }
  }
  render() {
    if (!this.isRunning) {
      return;
    }
    const output = Array.from(this.spinners.values()).map((spinner) => {
      const frame = frames[spinner.frame];
      spinner.frame = (spinner.frame + 1) % frames.length;
      const statusSymbol = spinner.statusSymbol ? spinner.statusSymbol : spinner.status === "success" ? S_STEP_SUBMIT : spinner.status === "error" ? S_STEP_ERROR : frame;
      return `${statusSymbol}  ${spinner.message}`;
    }).join("\n");
    if (this.previousRenderedLines > 0) {
      this.stream.write(erase.lines(this.previousRenderedLines));
    }
    this.stream.write(cursor.to(0, 0));
    this.stream.write(output);
    this.previousRenderedLines = output.split("\n").length;
  }
}
function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1e3));
}
function test() {
  const initialTasks = [
    {
      title: "Task 1",
      task: async (message) => {
        await sleep(2);
        message("Task 1 is halfway done");
        await sleep(2);
        return "Task 1 completed successfully";
      }
    },
    {
      title: "Task 2",
      task: async (message) => {
        await sleep(1);
        message("Task 2 is progressing");
        await sleep(2);
        return "Task 2 finished";
      }
    }
  ];
  const multiSpinner = new MultiSpinner(initialTasks);
  const allTasksPromise = multiSpinner.start();
  setTimeout(() => {
    multiSpinner.addTask({
      title: "Task 3 with custom symbol",
      statusSymbol: "!",
      task: async (message) => {
        await sleep(1);
        message("Task 3 is running");
        await sleep(2);
        return "Task 3 completed";
      }
    });
  }, 1e3);
  setTimeout(() => {
    multiSpinner.addTask({
      title: "Task Alpha",
      task: async (message) => {
        await sleep(1);
        message("Task Alpha is executing");
        await sleep(1);
        throw new Error("Task Alpha failed");
      }
    });
  }, 2e3);
  setTimeout(() => {
    multiSpinner.addTask({
      title: "Task Beta",
      task: async (message) => {
        await sleep(1);
        message("Task Beta is executing");
        await sleep(1);
        return "Task Beta done";
      }
    });
  }, 3500);
  setTimeout(() => {
    multiSpinner.addTask({
      title: "Task 4 (Added)",
      task: async (message) => {
        await sleep(1);
        message("Task 4 is executing");
        await sleep(1);
        return "Task 4 done";
      }
    });
  }, 3e3);
  setTimeout(() => {
    multiSpinner.addTask({
      title: "Task 5 (Should not be added)",
      task: async (message) => {
        await sleep(1);
        return "This task should not run";
      }
    });
  }, 6e3);
  allTasksPromise.then(() => {
    console.log("\nAll tasks completed!");
    multiSpinner.stop();
  }).catch((error) => {
    console.error("\nAn error occurred:", error);
    multiSpinner.stop();
  });
}
test();
