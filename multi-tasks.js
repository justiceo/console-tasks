import { erase, cursor } from "sisteransi";
import isUnicodeSupported from "is-unicode-supported";
const unicode = isUnicodeSupported();
const s = (c, fallback) => unicode ? c : fallback;
const S_STEP_ACTIVE = s("\u25C6", "*");
const S_STEP_CANCEL = s("\u25A0", "x");
const S_STEP_ERROR = s("\u25B2", "x");
const S_STEP_SUBMIT = s("\u25C7", "o");
const frames = unicode ? ['◒', '◐', '◓', '◑'] : ["\u2022", "o", "O", "0"];
export class MultiSpinner {
  tasks;
  spinners;
  interval;
  previousRenderedLines;
  isRunning;
  taskPromises;
  resolveAllTasks;
  constructor(tasks) {
    this.tasks = tasks;
    this.spinners = /* @__PURE__ */ new Map();
    this.interval = null;
    this.previousRenderedLines = 0;
    this.isRunning = false;
    this.taskPromises = [];
    this.resolveAllTasks = null;
    this.initializeTasks(tasks);
  }
  initializeTasks(tasks) {
    tasks.forEach((task, index) => {
      if (task.enabled !== false) {
        this.spinners.set(String(index), {
          frame: 0,
          message: task.title,
          status: "pending"
        });
      }
    });
  }
  start() {
    this.isRunning = true;
    process.stdout.write("\n");
    this.render();
    this.interval = setInterval(() => this.render(), 80);
    return new Promise((resolve) => {
      this.resolveAllTasks = resolve;
      this.tasks.forEach((task, index) => {
        this.taskPromises.push(this.executeTask(task, index));
      });
    });
  }
  stop() {
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.render();
    process.stdout.write("\n");
  }
  update(index, message) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.message = message;
    }
  }
  succeed(index, message) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.status = "success";
      if (message) spinner.message = message;
    }
  }
  fail(index, message) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.status = "error";
      if (message) spinner.message = message;
    }
  }
  addTask(task) {
    if (this.hasPendingTasks()) {
      const newIndex = this.spinners.size;
      this.spinners.set(String(newIndex), {
        frame: 0,
        message: task.title,
        status: "pending"
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
      const statusSymbol = spinner.status === "success" ? S_STEP_SUBMIT : spinner.status === "error" ? S_STEP_ERROR : frame;
      return `${statusSymbol}  ${spinner.message}`;
    }).join("\n");
    if (this.previousRenderedLines > 0) {
      process.stdout.write(erase.lines(this.previousRenderedLines));
    }
    process.stdout.write(cursor.to(0, 0));
    process.stdout.write(output);
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
      title: "Task 3 (Added)",
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
