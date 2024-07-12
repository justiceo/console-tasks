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
  rows;
  abortController;
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
    this.rows = stream.rows || 0;
    this.abortController = new AbortController();
    stream.on("resize", () => {
      this.rows = stream.rows || 0;
    });
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
    process.on("SIGINT", () => {
      this.stop();
    });
    return allPromises;
  }
  /**
   * Stops the spinner and renders the final state.
   */
  stop() {
    if (!this.isRunning) return;
    this.cancelPendingTasks();
    this.render();
    this.isRunning = false;
    this.abortController.abort();
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.stream.write("\n");
    if (this.resolveAllTasks) {
      this.resolveAllTasks();
    }
  }
  cancelPendingTasks() {
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
  update(index, message) {
    const spinner = this.spinners.get(index);
    if (spinner) {
      spinner.message = message;
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
    const spinner = this.spinners.get(index);
    if (!spinner) {
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
      const statusSymbol = spinner.statusSymbol ? spinner.statusSymbol : spinner.status === "success" ? color.green(S_STEP_SUBMIT) : spinner.status === "error" ? color.red(S_STEP_ERROR) : spinner.status === "cancelled" ? color.yellow(S_STEP_CANCEL) : frame;
      return `|
${statusSymbol}  ${spinner.message}`;
    }).join("\n");
    if (this.previousRenderedLines > 0) {
      this.stream.write(erase.lines(this.previousRenderedLines));
    }
    this.stream.write(cursor.to(0, 0));
    const currentOutputLines = output.split("\n").length;
    if (currentOutputLines <= this.rows) {
      this.stream.write(output);
    } else {
      this.stream.write(
        output.split("\n").slice(currentOutputLines - this.rows).join("\n")
      );
    }
    this.previousRenderedLines = currentOutputLines;
  }
}
class BaseTask {
  initialMessage;
  updateFn = () => {
  };
  signal;
  close;
  fail;
  constructor(title) {
    this.initialMessage = title ?? "";
  }
  task = async (updateFn, signal) => {
    this.updateFn = updateFn;
    this.signal = signal;
    if (signal?.aborted) return Promise.resolve("Aborted");
    const abortHandler = () => {
      this.close("Aborted");
    };
    signal.addEventListener("abort", abortHandler, { once: true });
    const p = new Promise((resolve, reject) => {
      if (signal.aborted) {
        resolve();
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
export const addMessage = (msg) => {
  TaskManager.getInstance().add({
    initialMessage: msg,
    task: async () => {
    }
  });
};
class StreamTask extends BaseTask {
  text = "";
  initialMessage = "Stream Task";
  stream(text) {
    this.text += text;
    this.updateFn(this.text);
  }
}
class Logger extends BaseTask {
  initialMessage = "Logger";
  log(msg) {
    this.updateFn(msg);
  }
}
function logIt(msg) {
  addMessage(msg);
}
logIt("Task 1");
logIt("Task 2");
logIt("Task 3");
function sleep(seconds, signal) {
  if (signal?.aborted) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, seconds * 1e3);
    if (signal) {
      signal.addEventListener("abort", () => {
        clearTimeout(timeout);
        resolve();
      });
    }
  });
}
function test() {
  const s2 = new StreamTask("Stream Task 2");
  const initialTasks = [
    {
      initialMessage: "Task 1",
      index: 1e3,
      task: async (message, signal) => {
        await sleep(2, signal);
        message("Task 1 is halfway done");
        await sleep(2, signal);
        message("Task 1 completed successfully");
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
      task: async (message, signal) => {
        await sleep(1, signal);
        message("This task should not run");
        await sleep(2, signal);
        message("Disabled Task finished");
      }
    },
    s2
  ];
  s2.stream("Stream Task 2 is running");
  const taskManager = TaskManager.getInstance();
  taskManager.add(...initialTasks);
  const allTasksPromise = taskManager.run();
  taskManager.add({
    initialMessage: "Task 3 with custom symbol",
    statusSymbol: "#",
    task: async (message, signal) => {
      await sleep(1, signal);
      message("Task 3 is running");
      const s3 = new StreamTask("Stream Task 3");
      taskManager.add(s3);
      s3.stream("Stream Task 3 is running");
      await sleep(2, signal);
      s3.close("Stream Task 3 completed");
      message("Task 3 completed");
    }
  });
  const interval = setInterval(() => {
    s2.stream("\nLorem ipsum dolor sit amet, consectetur adipiscing elit.");
  }, 500);
  setTimeout(() => {
    clearInterval(interval);
    s2.close("Finished");
  }, 3e3);
  setTimeout(() => {
    taskManager.add({
      initialMessage: "Task 4 with failure",
      task: async (message, signal) => {
        await sleep(1, signal);
        message("Task with failure is executing");
        await sleep(1, signal);
        throw new Error("Random error");
      }
    });
  }, 1e3);
  setTimeout(() => {
    taskManager.add({
      initialMessage: "Task 5 added late",
      task: async (message, signal) => {
        await sleep(1, signal);
        message("Task 5 is executing");
        await sleep(1, signal);
        message("Task 5 is done");
      }
    });
  }, 2500);
  setTimeout(() => {
    taskManager.add({
      initialMessage: "Task Too late (Should not be added)",
      task: async (message, signal) => {
        await sleep(1, signal);
        message("This task should not run");
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
