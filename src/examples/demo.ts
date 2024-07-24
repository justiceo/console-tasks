import { TaskManager, sequence, addMessage, color, Task, UI_SYMBOLS } from "..";
import { StreamTask } from "../widgets/stream";
import { Logger } from "../widgets/logger";
import { note } from "../widgets/note";
import { code } from "../widgets/code";
import { Stopwatch, TaskTimer, Timer } from "../widgets/timer";

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

const taskManager = TaskManager.getInstance({
  title: " Demo ",
});

async function write(message, task) {
  for (const chunk of message.split(" ")) {
    task.stream(chunk + " ");
    await sleep(0.1);
  }
}

async function welcome() {
  const welcomeMessage = new StreamTask("Welcome!22");
  taskManager.run(welcomeMessage);
  taskManager.run(new Stopwatch());
  taskManager.run();
  const message1 =
    "Welcome!\n\nConsolesTasks is great for displaying concurrent tasks in the console,\n" +
    "especially when you want each task to own its own UI or rendering logic.\n\n";
  await write(message1, welcomeMessage);
  await sleep(1);
  const message2 =
    "For example, the task rendering this text is running alongside the stopwatch below.\n";
  await write(message2, welcomeMessage);
  await sleep(3);
  welcomeMessage.close();

  // Insert task status here.
  await taskStatus(taskManager);
  await sleep(3);
  await staticContent(taskManager);
  await sleep(3);
  await abortMessage();
}
await welcome();
taskManager.stop();

async function taskStatus(tm: TaskManager) {
  const mssg = new StreamTask("Task Status");
  tm.run(mssg);
  await write(
    "Tasks may be in one of four states: Pending, Successful, Failed or Cancelled.\n",
    mssg
  );
  mssg.close();
  await sleep(2);

  const pendingTask: Task = {
    initialMessage: "This task is pending (i.e. running)",
    task: async (updateFn, abortSignal) => {
      return new Promise((resolve) => setInterval(() => {}, 1000));
    },
  };
  tm.run(pendingTask);
  await sleep(1);

  const successTask: Task = {
    initialMessage: "This is a successful task",
    task: async (updateFn, abortSignal) => {},
  };
  tm.run(successTask);
  await sleep(1);

  const failedTask: Task = {
    initialMessage: "Here is a failed task (notice the symbol change)",
    task: async (updateFn, abortSignal) => {
      throw new Error("Fatal Error: Dog successfully bit its tail");
    },
  };
  tm.run(failedTask);
  await sleep(1);

  const cancelledTask: Task = {
    statusSymbol: color.yellow(UI_SYMBOLS.WARN_STATUS),
    initialMessage: "This task was cancelled",
    task: async (updateFn, abortSignal) => {
      return;
      // For non-demo purposes, a task is cancelled by calling taskManager.stop()
      const timeout = setTimeout(() => {
        updateFn(`Pending task will be cancelled in 3secs`);
      }, 2000);
      abortSignal.addEventListener("abort", () => {
        clearInterval(timeout);
      });
      await new Promise((resolve) =>
        setTimeout(() => taskManager.stop(), 5000)
      );
    },
  };
  tm.run(cancelledTask);
  await sleep(1);
}

async function staticContent(taskManager) {
  const message = new StreamTask("static content");
  taskManager.run(message);
  const message3 =
    "ConsoleTasks can also be used to display static content like logs, notes, and code snippets.\n" +
    "Here are sample logs:";
  await write(message3, message);
  message.close();
  await sleep(3);

  const logger = new Logger({ tag: "Demo", enableDebug: true });
  logger.log("This is an INFO message");
  await sleep(1);
  logger.warn("Here is a WARNING message");
  await sleep(1);
  logger.error("ERROR messages are ofcourse in red");
  await sleep(3);

  const noteMessage = new StreamTask("Notes");
  taskManager.run(noteMessage);
  await write(
    "Notes are a great way to display information in a structured way.\nHere is a sample:",
    noteMessage
  );
  noteMessage.close();
  await sleep(1);
  taskManager.run(
    note(
      "Notes (like log messages) are basically tasks that do not have a function to execute.\nSo they are completed upon creation.",
      "Sample Note"
    )
  );
  await sleep(3);

  const codeMessage = new StreamTask("Code Blocks");
  taskManager.run(codeMessage);
  await write(
    "Code blocks display color-formatted code snippets that are easy to copy.\nHere is a sample:",
    codeMessage
  );
  codeMessage.close();
  await sleep(1);

  const fibonacci = `function fibonacci(num) {
    let num1 = 0;
    let num2 = 1;
    let sum;
    if (num === 1) {
        return num1;
    } else if (num === 2) {
        return num2;
    } else {
        for (let i = 3; i <= num; i++) {
            sum = num1 + num2;
            num1 = num2;
            num2 = sum;
        }
        return num2;
    }
}

console.log("Fibonacci(5): " + fibonacci(5));
console.log("Fibonacci(8): " + fibonacci(8));`;
  taskManager.run(code(fibonacci, "javascript"));
}

async function abortMessage() {
  const abortMessage = new StreamTask("Abort Message");
  taskManager.run(abortMessage);
  await write(
    "To cancel all pending tasks (like the elapsed timer below)...",
    abortMessage
  );
  await sleep(2);
  await write(
    " and stop the task manager, press Ctrl+C or call taskManager.stop().\n",
    abortMessage
  );
  await sleep(1);
  await write("This will also prevent new tasks from being added.\n\n", abortMessage);
  await sleep(2);
  await write("Hitting Ctrl+C, hope you enjoyed the demo!", abortMessage);
  abortMessage.close();
  await sleep(3);
}
// taskManager.run(new TaskTimer(new Timer(6000)));

// function test() {
//   const s2 = new StreamTask("Stream Task 2");
//   const parentTask: Task = {
//     initialMessage: "Parent Task",
//     task: async (updateFn, signal) => {
//       updateFn("Parent task is running");
//       await sleep(2);
//       updateFn("Parent task is done");
//       return {
//         initialMessage: "Child Task",
//         task: async (childUpdateFn, childSignal) => {
//           childUpdateFn("Child task is running");
//           await sleep(2);
//           childUpdateFn("Child task is done");
//         },
//       };
//     },
//   };
//   const initialTasks: Task[] = [
//     {
//       initialMessage: "Task 1",
//       index: 1000,
//       task: async (message, signal) => {
//         await sleep(2, signal);
//         // taskManager.stop();
//         message("Task 1 is halfway done");
//         await sleep(2, signal);
//         message("Task 1 completed successfully");
//       },
//     },
//     {
//       initialMessage: "Task 2: Empty Task",
//       task: async (message) => {},
//     },
//     {
//       initialMessage: "Task Disabled",
//       disabled: true,
//       task: async (message, signal) => {
//         await sleep(1, signal);
//         message("This task should not run");
//         await sleep(2, signal);
//         message("Disabled Task finished");
//       },
//     },
//     sequence(s2, parentTask),
//   ];

//   s2.stream("Stream Task 2 is running");

//   taskManager.run(...initialTasks);
//   taskManager.run(new Stopwatch());
//   taskManager.run(
//     note("This is a note\nAnd an even longer note", "Note"));
//   taskManager.run(code("console.log('Hello, World!');", "javascript"));

//   // Start the spinner and get the promise
//   const allTasksPromise = taskManager.run();

//   // Add a new task after 1 second
//   taskManager.run({
//     initialMessage: "Task 3 with custom symbol",
//     statusSymbol: "#",
//     task: async (message, signal) => {
//       await sleep(3, signal);
//       message("Task 3 is running");
//       const s3 = new StreamTask("Stream Task 3");
//       taskManager.run(s3);
//       s3.stream("Stream Task 3 is running");
//       await sleep(2, signal);
//       s3.close();
//       message("Task 3 completed");
//     },
//   });

//   const interval = setInterval(() => {
//     s2.stream("\nLorem ipsum dolor sit amet, consectetur adipiscing elit.");
//   }, 500);
//   setTimeout(() => {
//     clearInterval(interval);
//     s2.close();
//   }, 3000);

//   // Add another task after 2 seconds with a specific index
//   setTimeout(() => {
//     taskManager.run({
//       initialMessage: "Task 4 with failure",
//       task: async (message, signal) => {
//         await sleep(1, signal);
//         message("Task with failure is executing");
//         await sleep(1, signal);
//         throw new Error("Random error");
//       },
//     });
//   }, 1000);

//   setTimeout(() => {
//     taskManager.run({
//       initialMessage: "Task 5 added late",
//       task: async (message, signal) => {
//         await sleep(1, signal);
//         message("Task 5 is executing");
//         await sleep(1, signal);
//         message("Task 5 is done");
//       },
//     });
//   }, 2500);

//   // Try to add a task after all tasks are completed (should have no effect)
//   // setTimeout(() => {
//   //   taskManager.run({
//   //     initialMessage: "Task Too late (Should not be added)",
//   //     task: async (message, signal) => {
//   //       await sleep(1, signal);
//   //       message("This task should not run");
//   //     },
//   //   });
//   // }, 6000);

//   // Wait for all tasks to complete
//   allTasksPromise
//     .then(() => {
//       console.log("\nAll tasks completed!");
//     })
//     .catch((error) => {
//       console.error("\nAn error occurred:", error);
//     });
// }

// // test();
