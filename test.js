import { tasks, MultiSpinner, sleep } from "./multi-tasks.js";

const multiSpinner = new MultiSpinner([
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
]);

multiSpinner.start();

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
}, 10000);

// try {
//   await Promise.all(multiSpinner.tasks.map((task, index) => multiSpinner.executeTask(task, index)));
// } finally {
//   multiSpinner.stop();
// }