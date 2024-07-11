import { tasks } from "./multi-tasks.js";

await tasks([
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
    title: "Task 1B",
    task: async (message) => {
      await sleep(2);
      message("Task 1B is halfway done");
      await sleep(2);
      message("Well 1B is almost there");
      await sleep(2);
      return "Task 1B completed successfully";
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

function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
