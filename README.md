# ConsoleTasks

ConsoleTasks is a flexible NodeJs library for managing and displaying concurrent or sequential tasks in the console. It provides a clean and intuitive API for creating, executing, and monitoring tasks with a highly configurable and visually appealing progress display.

## Features

- Concurrent and sequential task execution
- A task completely owns its rendering in the console UI
- Task status updates (running, successful, failed, or cancelled)
- Easily customizable spinners for all or specific tasks
- Support for dynamic task creation
- Graceful handling of task cancellation
- TypeScript support for enhanced type safety

## Installation

To install ConsoleTasks, use npm:

```bash
npm install console-tasks
```

## Basic Usage

Here's a basic example of how to use ConsoleTasks:

```typescript
import { TaskManager } from 'console-tasks';

// Define a task
const exampleTask = {
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

// Add and execute the tasks in parallel.
taskManager.add(exampleTask, exampleTask, exampleTask);
await taskManager.run();
```
Which results in this

![Basic Demo](basic-demo.gif)


## API Reference

### TaskManager

The `TaskManager` class is responsible for managing and executing tasks.

#### Methods

- `static getInstance(options?: TaskManagerOptions): TaskManager`
  - Gets or creates a singleton instance of TaskManager.
  - `options`: Configuration options for the TaskManager.

- `add(...tasks: Task[]): number[]`
  - Adds new tasks to the TaskManager.
  - Returns an array of task IDs for each of the tasks.

- `run(): Promise<void>`
  - Starts the execution of tasks and renders the spinner.
  - Returns a promise that resolves when all tasks are completed.

- `stop(): void`
  - Stops the spinner and renders the final state.

- `update(taskId: number, message: string): void`
  - Updates the message for a specific task.

- `onStatusChange(taskId: number, handler: (newStatus: SpinnerStatus) => void): void`
  - Registers a handler for status changes of a specific task.

#### TaskManagerOptions

- `stream?: Writable`: The output stream (default: process.stdout).
- `title?: string`: The title to display above the tasks.
- `customStatusSymbols?: Partial<StatusSymbol>`: Custom status symbols for tasks.
- `keepAlive?: boolean`: Whether to keep the task manager running after all tasks are completed.
- `taskPrefix?: (taskSeparator: string, statusSymbol: string) => string`: Custom task prefix function.
- `stopAndRecreate?: boolean`: Whether to recreate the TaskManager if an instance exists already.
- `headerFormatter?: (title: string) => string`: Function to format / style the header.

### Task

The `Task` interface represents a task to be executed by the TaskManager.

#### Properties

- `initialMessage: string`: The initial message to be displayed.
- `task: (updateFn: (msg: string) => void, signal: AbortSignal) => Promise<Task | void>`: The actual task function.
- `disabled?: boolean`: Whether the task is disabled (default: false).
- `isHidden?: boolean`: When true, the task is run but its UI is not rendered.
- `statusSymbol?: string | Partial<StatusSymbol>`: Custom status symbol to display instead of the spinner.
- `index?: number`: Optional index for positioning the task in the console output.

### Helper Functions

- `addMessage(msg: string, statusSymbol?: string): void`
  - Adds a simple message task to the TaskManager.

- `sequence(...tasks: Task[]): Task`
  - Chains the given tasks for sequential execution.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License.