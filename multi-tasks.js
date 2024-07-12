import { erase, cursor } from "sisteransi";
import color from "picocolors";
import isUnicodeSupported from "is-unicode-supported";
const unicode = isUnicodeSupported();
const s = (c, fallback) => unicode ? c : fallback;
const S_STEP_ACTIVE = s("\u25C6", "*");
const S_STEP_CANCEL = s("\u25A0", "x");
const S_STEP_ERROR = s("\u25B2", "x");
const S_STEP_SUBMIT = s("\u25C7", "o");
const frames = unicode ? ["\u25D2", "\u25D0", "\u25D3", "\u25D1"] : ["\u2022", "o", "O", "0"];
export class TaskManager {
  static instance;
  tasks;
  spinners;
  interval;
  previousRenderedLines;
  isRunning;
  taskPromises;
  resolveAllTasks;
  stream;
  /**
   * Creates a new TaskManager instance.
   * @param tasks - An array of tasks to be executed
   * @param stream - The output stream to write to (default: process.stdout)
   */
  constructor(stream = process.stdout) {
    this.tasks = [];
    this.spinners = /* @__PURE__ */ new Map();
    this.interval = null;
    this.previousRenderedLines = 0;
    this.isRunning = false;
    this.taskPromises = [];
    this.resolveAllTasks = null;
    this.stream = stream;
  }
  static getInstance() {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }
  /**
   * Starts the execution of tasks and renders the spinner.
   * @returns A promise that resolves when all tasks are completed
   */
  run() {
    this.isRunning = true;
    this.stream.write("\n");
    this.render();
    this.interval = setInterval(() => this.render(), 80);
    const allPromises = new Promise((resolve) => {
      this.resolveAllTasks = resolve;
      this.tasks.forEach((task, defaultIndex) => {
        const index = task.index !== void 0 ? task.index : defaultIndex;
        this.taskPromises.push(this.executeTask(task, index));
      });
    });
    allPromises.finally(() => {
      this.stop();
    });
    return allPromises;
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
    const spinner = this.spinners.get(index);
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
    const spinner = this.spinners.get(index);
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
    const spinner = this.spinners.get(index);
    if (spinner) {
      spinner.status = "error";
      if (message) spinner.message = message;
    }
  }
  /**
   * Adds a new task to the spinner.
   * @param task - The task to add
   */
  add(...tasks) {
    tasks.forEach((task) => {
      if (task.disabled) return;
      const newIndex = task.index !== void 0 ? task.index : this.spinners.size;
      this.spinners.set(newIndex, {
        frame: 0,
        message: task.initialMessage,
        status: "pending",
        statusSymbol: task.statusSymbol
      });
      this.tasks.push(task);
      if (this.isRunning) {
        this.taskPromises.push(this.executeTask(task, newIndex));
      }
    });
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
      this.succeed(index, result || task.initialMessage);
    } catch (error) {
      this.fail(index, `${task.initialMessage} (Error: ${error.message})`);
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
    const sortedSpinners = Array.from(this.spinners.entries()).sort(
      ([a], [b]) => a - b
    );
    const output = sortedSpinners.map(([_, spinner]) => {
      const frame = color.magenta(frames[spinner.frame]);
      spinner.frame = (spinner.frame + 1) % frames.length;
      const statusSymbol = spinner.statusSymbol ? spinner.statusSymbol : spinner.status === "success" ? color.green(S_STEP_SUBMIT) : spinner.status === "error" ? color.red(S_STEP_ERROR) : frame;
      return `|
${statusSymbol}  ${spinner.message}`;
    }).join("\n");
    if (this.previousRenderedLines > 0) {
      this.stream.write(erase.lines(this.previousRenderedLines));
    }
    this.stream.write(cursor.to(0, 0));
    this.stream.write(output);
    this.previousRenderedLines = output.split("\n").length;
  }
}
class BaseTask {
  initialMessage;
  console = () => {
  };
  close;
  fail;
  constructor(title) {
    this.initialMessage = title ?? "";
  }
  task = async (consoleFn) => {
    this.console = consoleFn;
    return new Promise((resolve, reject) => {
      this.close = resolve;
      this.fail = reject;
    });
  };
}
export const addMessage = (msg) => {
  TaskManager.getInstance().add({
    initialMessage: msg,
    task: async () => {
    }
  });
};
class StreamTask extends BaseTask {
  initialMessage = "Stream Task";
  stream(text) {
    this.console(text);
    setTimeout(() => {
      this.close(this.initialMessage + " completed");
    }, 2e3);
  }
}
class Logger extends BaseTask {
  initialMessage = "Logger";
  log(msg) {
    this.console(msg);
  }
}
function logIt(msg) {
  addMessage(msg);
}
logIt("Task 1");
logIt("Task 2");
logIt("Task 3");
function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1e3));
}
function test() {
  const s2 = new StreamTask("Stream Task 2");
  const initialTasks = [
    {
      initialMessage: "Task 1",
      index: 1e3,
      task: async (message) => {
        await sleep(2);
        message("Task 1 is halfway done");
        await sleep(2);
        return "Task 1 completed successfully";
      }
    },
    {
      initialMessage: "Task 2: Empty Task",
      task: async (message) => {
      }
    },
    {
      initialMessage: "Task Disabled",
      disabled: true,
      task: async (message) => {
        await sleep(1);
        message("This task should not run");
        await sleep(2);
        return "Disabled Task finished";
      }
    },
    s2
  ];
  s2.stream("Stream Task 2 is running");
  const taskManager = TaskManager.getInstance();
  taskManager.add(...initialTasks);
  const allTasksPromise = taskManager.run();
  setTimeout(() => {
    taskManager.add({
      initialMessage: "Task 3 with custom symbol",
      statusSymbol: "!",
      task: async (message) => {
        await sleep(1);
        message("Task 3 is running");
        const s3 = new StreamTask("Stream Task 3");
        taskManager.add(s3);
        s3.stream("Stream Task 3 is running");
        await sleep(2);
        return "Task 3 completed";
      }
    });
  }, 1e3);
  setTimeout(() => {
    taskManager.add({
      initialMessage: "Task 4 with failure",
      task: async (message) => {
        await sleep(1);
        message("Task with failure is executing");
        await sleep(1);
        throw new Error("Random error");
      }
    });
  }, 2e3);
  setTimeout(() => {
    taskManager.add({
      initialMessage: "Task 5 added late",
      task: async (message) => {
        await sleep(1);
        message("Task 5 is executing");
        await sleep(1);
        return "Task 5 done";
      }
    });
  }, 3500);
  setTimeout(() => {
    taskManager.add({
      initialMessage: "Task Too late (Should not be added)",
      task: async (message) => {
        await sleep(1);
        return "This task should not run";
      }
    });
  }, 6e3);
  allTasksPromise.then(() => {
    console.log("\nAll tasks completed!");
  }).catch((error) => {
    console.error("\nAn error occurred:", error);
  });
}
test();
