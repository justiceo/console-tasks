import { Task, TaskManager } from "./task-api";

/**
 * Adds a simple message task to the TaskManager.
 * @param msg - The message to display
 */
export const addMessage = (msg: string, statusSymbol?: string): void => {
  TaskManager.getInstance().run({
    statusSymbol: statusSymbol,
    initialMessage: msg,
    task: async () => {},
  });
};

/**
 * Converts a function into a task and executes it.
 * @param fn The function to execute as a task.
 * @param title An optional title for the task.
 * @returns A promise that resolves when the task is completed.
 */
export const taskify = async <T>(
  fn: () => Promise<T>,
  title: string = "Task",
  completedMessage?: string
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const task: Task = {
      initialMessage: title,
      task: async (updateFn, signal) => {
        try {
          const result = await fn();
          if (completedMessage) {
            updateFn(completedMessage);
          }
          return result;
        } catch (error) {
          updateFn(`${title} failed: ${error.message}`);
          throw error;
        }
      },
    };

    const taskManager = TaskManager.getInstance();
    const [taskId] = taskManager.run(task);

    taskManager.onStatusChange(taskId, (newStatus, data) => {
      if (newStatus === "success") {
        resolve(data);
      } else if (newStatus === "error") {
        reject(data);
      }
    });
  });
};

/**
 * Creates a task that executes a sequence of tasks.
 * @param tasks The tasks to execute in sequence.
 * @returns A new Task that represents the sequence of tasks.
 */
export const sequence = (...tasks: Task[]): Task => {
  tasks.forEach((task, i) => {
    const origTaskFn = task.task;
    task.task = async (updateFn, signal) => {
      const result = await origTaskFn(updateFn, signal);

      // If the result is a task, insert it into the sequence.
      if (result && typeof result === "object" && "task" in result) {
        tasks.splice(i + 1, 0, result);
      }

      return result;
    };
  });

  // Return the first task in the sequence.
  return tasks[0];
};
