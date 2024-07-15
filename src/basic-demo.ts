import { Task, TaskManager } from "./index";

// Define a task
const exampleTask: Task = {
  initialMessage: "Starting example task...",
  task: async (updateFn, abortSignal) => {
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate async work
    updateFn("Example task in progress...");
    await new Promise((resolve) => setTimeout(resolve, 2000)); // More async work
    updateFn("Example task completed!");
  },
};

// Create a TaskManager instance
const taskManager = TaskManager.getInstance({ title: " Example " });

// Add and execute the task(s)
taskManager.add(exampleTask, exampleTask, exampleTask);
await taskManager.run();
