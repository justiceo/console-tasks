import { Logger } from "./logger";
import { TaskManager, TaskManagerOptions } from "..";

// Store the original console
const originalConsole = console;
let taskManager = null;

// Function to replace the global console
export function replaceGlobalConsole(options?: TaskManagerOptions) {
  // Create a new object with the same properties as the original console
  const newConsole: Console = Object.create(null);

  taskManager = TaskManager.getInstance(options);

  // Create a new Logger instance
  const logger = new Logger({ enableDebug: true });

  // Map console methods to Logger methods
  const methodMap = {
    log: "log",
    debug: "debug",
    info: "log",
    warn: "warn",
    error: "error",
  };

  // Iterate over all properties of the original console
  for (const prop in console) {
    if (typeof console[prop] === "function") {
      if (prop in methodMap) {
        // If the property is in our method map, use the corresponding Logger method
        newConsole[prop] = (...args: any[]) => {
          logger[methodMap[prop]](...args);
        };
      } else {
        // For other methods, just use the original function
        newConsole[prop] = (...args: any[]) => {
          originalConsole[prop](...args);
        };
      }
    } else {
      // For non-function properties, just copy them
      newConsole[prop] = console[prop];
    }
  }

  // Replace the global console
  global.console = newConsole as Console;
}

// Function to reset the global console to the original
export async function resetGlobalConsoleAsync() {
  if (taskManager) {
    await taskManager.await();
  }
  global.console = originalConsole;
}
