import { Task, TaskManager } from "../task-api";

// Define a task
const successTask: Task = {
  initialMessage: "Successful task",
  task: async (updateFn, abortSignal) => {},
};

const failedTask: Task = {
  initialMessage: "Failed task",
  task: async (updateFn, abortSignal) => {
    throw new Error("Fatal Error: Dog successfully bit its tail");
  },
};

const cancelledTask: Task = {
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

// Create a TaskManager instance
const taskManager = TaskManager.getInstance({ title: " Task Status " });

// Add and execute the task(s)
taskManager.run(cancelledTask, successTask, failedTask);
await taskManager.idle();
