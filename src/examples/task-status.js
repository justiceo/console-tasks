import { TaskManager } from "../../dist/index.js";
import { note } from "../../dist/widgets/index.js";

// Define a task
const successTask = {
  initialMessage: "Successful task",
  task: async (updateFn, abortSignal) => {},
};

const failedTask = {
  initialMessage: "Failed task",
  task: async (updateFn, abortSignal) => {
    throw new Error("Fatal Error: Dog successfully bit its tail");
  },
};

const cancelledTask = {
  initialMessage: "Pending task",
  task: async (updateFn, abortSignal) => {
    const timeout = setTimeout(() => {
      updateFn(`Pending task will be cancelled in 3secs`);
    }, 2000);
    abortSignal.addEventListener("abort", () => {
      clearInterval(timeout);
    });
    await new Promise((resolve) => setTimeout(() => taskManager.stop(), 5000));
  },
};

const noteMessage = note("Tasks can be in one of four possible states: \npending (running), successful, cancelled and error", "Note");

// Create a TaskManager instance
const taskManager = TaskManager.getInstance({ title: " Task Status " });

// Add and execute the task(s)
taskManager.add(cancelledTask, successTask, failedTask, noteMessage);
await taskManager.run();
