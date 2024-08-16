import { Logger } from "./logger";
import { TaskManager, TaskManagerOptions } from "..";
import { StreamTask } from "./stream";
import { code } from "./code";
import { InspectOptions } from "util";
import { ConfirmationPrompt } from "./confirmation-prompt";
import { note } from "./note";
import { Stopwatch } from "./timer";

/** Enhanced implementation of nodejs Console. */
class ConsolePlus implements Console {
  private logger: Logger;
  private streamTask: StreamTask;
  private confirmationPrompt: ConfirmationPrompt;
  private stopwatch: Stopwatch;
  private hasStreamingTask: boolean = false;
  private hasStopwatchTask: boolean = false;

  constructor() {
    this.logger = new Logger({ enableDebug: true });
    this.streamTask = new StreamTask();
    this.stopwatch = new Stopwatch();
  }
  log(...args: any[]): void {
    this.logger.log(...args);
  }
  debug(...args: any[]): void {
    this.logger.debug(...args);
  }
  info(...args: any[]): void {
    this.logger.log(...args);
  }
  warn(...args: any[]): void {
    this.logger.warn(...args);
  }
  error(...args: any[]): void {
    this.logger.error(...args);
  }

  stream(chunk: string): void {
    if (!this.hasStreamingTask) {
      this.streamTask = new StreamTask();
      TaskManager.getInstance().run(this.streamTask);
      this.hasStreamingTask = true;
    }
    this.streamTask.stream(chunk);
  }
  endStream(): void {
    this.streamTask.close();
    this.hasStreamingTask = false;
  }

  code(codeStr: string, title?: string): void {
    TaskManager.getInstance().run(code(codeStr, title));
  }

  confirm(question: string): Promise<boolean> {
    this.confirmationPrompt = new ConfirmationPrompt(question);
    const [taskId] = TaskManager.getInstance().run(this.confirmationPrompt);
    return new Promise((resolve, reject) => {
      TaskManager.getInstance().onStatusChange(taskId, (status, data) => {
        if (typeof data === "boolean") {
          resolve(data);
        }
        resolve(false);
      });
    });
  }

  note(content: string, title: string): void {
    TaskManager.getInstance().run(note(content, title));
  }

  status(message: string): void {
    if (!this.hasStopwatchTask) {
      this.stopwatch = new Stopwatch();
      TaskManager.getInstance().run(this.stopwatch);
      this.hasStopwatchTask = true;
    }
    this.stopwatch.setMessage(message);
  }
  endStatus(message): void {
    if (message) {
      this.stopwatch.setMessage(message);
      this.stopwatch.updateFn(message);
    }
    this.stopwatch.close();
    this.hasStopwatchTask = false;
  }

  // TODO: Implement all methods of the Console class.
  // Run node src/examples/console-apis-demo.js to see them in action.

  assert(condition?: boolean, ...data: any[]): void;
  assert(value: any, message?: string, ...optionalParams: any[]): void;
  assert(
    value?: unknown,
    message?: unknown,
    ...optionalParams: unknown[]
  ): void {
    throw new Error("Method not implemented.");
  }
  clear(): void;
  clear(): void;
  clear(): void {
    throw new Error("Method not implemented.");
  }
  count(label?: string): void;
  count(label?: string): void;
  count(label?: unknown): void {
    throw new Error("Method not implemented.");
  }
  countReset(label?: string): void;
  countReset(label?: string): void;
  countReset(label?: unknown): void {
    throw new Error("Method not implemented.");
  }
  dir(item?: any, options?: any): void;
  dir(obj: any, options?: InspectOptions): void;
  dir(obj?: unknown, options?: unknown): void {
    throw new Error("Method not implemented.");
  }
  dirxml(...data: any[]): void;
  dirxml(...data: any[]): void;
  dirxml(...data: unknown[]): void {
    throw new Error("Method not implemented.");
  }
  group(...data: any[]): void;
  group(...label: any[]): void;
  group(...label: unknown[]): void {
    throw new Error("Method not implemented.");
  }
  groupCollapsed(...data: any[]): void;
  groupCollapsed(...label: any[]): void;
  groupCollapsed(...label: unknown[]): void {
    throw new Error("Method not implemented.");
  }
  groupEnd(): void;
  groupEnd(): void;
  groupEnd(): void {
    throw new Error("Method not implemented.");
  }
  table(tabularData?: any, properties?: string[]): void;
  table(tabularData: any, properties?: readonly string[]): void;
  table(tabularData?: unknown, properties?: unknown): void {
    throw new Error("Method not implemented.");
  }
  time(label?: string): void;
  time(label?: string): void;
  time(label?: unknown): void {
    throw new Error("Method not implemented.");
  }
  timeEnd(label?: string): void;
  timeEnd(label?: string): void;
  timeEnd(label?: unknown): void {
    throw new Error("Method not implemented.");
  }
  timeLog(label?: string, ...data: any[]): void;
  timeLog(label?: string, ...data: any[]): void;
  timeLog(label?: unknown, ...data: unknown[]): void {
    throw new Error("Method not implemented.");
  }
  timeStamp(label?: string): void;
  timeStamp(label?: string): void;
  timeStamp(label?: unknown): void {
    throw new Error("Method not implemented.");
  }
  trace(...data: any[]): void;
  trace(message?: any, ...optionalParams: any[]): void;
  trace(message?: unknown, ...optionalParams: unknown[]): void {
    throw new Error("Method not implemented.");
  }
  Console: console.ConsoleConstructor;
  profile(label?: string): void {
    throw new Error("Method not implemented.");
  }
  profileEnd(label?: string): void {
    throw new Error("Method not implemented.");
  }
}

// Store the original console
const originalConsole = console;
let taskManager = null;

// Function to replace the global console
export function replaceGlobalConsole(options?: TaskManagerOptions) {
  // Intantiate the task manager with any provided options.
  taskManager = TaskManager.getInstance(options);

  // Replace the global console
  global.console = new ConsolePlus();
}

// Function to reset the global console to the original
export async function resetGlobalConsoleAsync() {
  if (taskManager) {
    await taskManager.await();
  }
  global.console = originalConsole;
}
