import { TaskManager, addMessage, sequence, Task, BaseTask } from "./cli-tasks";

class StreamTask extends BaseTask {
  text = "";
  initialMessage: string = "Stream Task";
  stream(text: string) {
    this.text += text;
    this.updateFn(this.text);
  }
}

class Logger extends BaseTask {
  initialMessage: string = "Logger";
  log(msg: string) {
    this.updateFn(msg);
  }
}
function logIt(msg: string) {
  addMessage(msg);
}

logIt("Task 1");
logIt("Task 2");
logIt("Task 3");

///// Tests /////
function sleep(seconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, seconds * 1000);
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
  const parentTask: Task = {
    initialMessage: "Parent Task",
    task: async (updateFn, signal) => {
      updateFn("Parent task is running");
      await sleep(2);
      updateFn("Parent task is done");
      return {
        initialMessage: "Child Task",
        task: async (childUpdateFn, childSignal) => {
          childUpdateFn("Child task is running");
          await sleep(2);
          childUpdateFn("Child task is done");
        },
      };
    },
  };
  const initialTasks: Task[] = [
    {
      initialMessage: "Task 1",
      index: 1000,
      task: async (message, signal) => {
        await sleep(2, signal);
        // taskManager.stop();
        message("Task 1 is halfway done");
        await sleep(2, signal);
        message("Task 1 completed successfully");
      },
    },
    {
      initialMessage: "Task 2: Empty Task",
      task: async (message) => {},
    },
    {
      initialMessage: "Task Disabled",
      disabled: true,
      task: async (message, signal) => {
        await sleep(1, signal);
        message("This task should not run");
        await sleep(2, signal);
        message("Disabled Task finished");
      },
    },
    sequence(s2, parentTask),
  ];

  s2.stream("Stream Task 2 is running");

  const taskManager = TaskManager.getInstance();
  taskManager.add(...initialTasks);

  // Start the spinner and get the promise
  const allTasksPromise = taskManager.run();

  // Add a new task after 1 second
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
      s3.close();
      message("Task 3 completed");
    },
  });

  const interval = setInterval(() => {
    s2.stream("\nLorem ipsum dolor sit amet, consectetur adipiscing elit.");
  }, 500);
  setTimeout(() => {
    clearInterval(interval);
    s2.close();
  }, 3000);

  // Add another task after 2 seconds with a specific index
  setTimeout(() => {
    taskManager.add({
      initialMessage: "Task 4 with failure",
      task: async (message, signal) => {
        await sleep(1, signal);
        message("Task with failure is executing");
        await sleep(1, signal);
        throw new Error("Random error");
      },
    });
  }, 1000);

  setTimeout(() => {
    taskManager.add({
      initialMessage: "Task 5 added late",
      task: async (message, signal) => {
        await sleep(1, signal);
        message("Task 5 is executing");
        await sleep(1, signal);
        message("Task 5 is done");
      },
    });
  }, 2500);

  // Try to add a task after all tasks are completed (should have no effect)
  setTimeout(() => {
    taskManager.add({
      initialMessage: "Task Too late (Should not be added)",
      task: async (message, signal) => {
        await sleep(1, signal);
        message("This task should not run");
      },
    });
  }, 6000);

  // Wait for all tasks to complete
  allTasksPromise
    .then(() => {
      console.log("\nAll tasks completed!");
    })
    .catch((error) => {
      console.error("\nAn error occurred:", error);
    });
}

test();
