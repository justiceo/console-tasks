import { BaseTask, Task, TaskManager } from "../task-api";
export class Stopwatch extends BaseTask {
  index = 1100;
  unit = "s";
  message = "Elapsed ";
  startTime: [number, number];
  interval: NodeJS.Timeout;
  constructor() {
    super();
  }

  beforeClose(): void {
    if (this.interval) {
      clearInterval(this.interval);
    }
  }

  initialize() {
    this.startTime = process.hrtime();
    this.interval = setInterval(() => {
      const [seconds, nanoseconds] = process.hrtime(this.startTime);
      const elapsedSeconds = seconds + nanoseconds / 1e9;
      this.updateFn(`${this.message}${elapsedSeconds.toFixed(1)}${this.unit}`);

      if (this.signal?.aborted) {
        clearInterval(this.interval);
        this.close();
      }
    }, 100);
  }
  setMessage(message: string) {
    this.message = message;
  }
}

export class Timer extends BaseTask {
  index = 1102;
  durationMs: number;
  constructor(durationMs: number) {
    super();
    this.durationMs = durationMs;
    this.initialMessage = `This task will take ${durationMs}ms`;
  }

  initialize(): void {
    const timeout = setTimeout(() => {
      this.updateFn(`Timer for ${this.durationMs}ms completed.`);
      this.close();
    }, this.durationMs);

    const abortHandler = () => {
      clearTimeout(timeout);
      this.close();
    };
    this.signal?.addEventListener("abort", abortHandler, { once: true });
  }
}

export class TaskTimer extends BaseTask {
  index = 2000;
  startTime = process.hrtime();
  constructor(task: Task, unit = "s") {
    super();

    const interval = setInterval(() => {
      const [seconds, nanoseconds] = process.hrtime(this.startTime);
      const elapsedSeconds = seconds + nanoseconds / 1e9;
      this.updateFn(
        `Task ${task.initialMessage} Elapsed ${elapsedSeconds.toFixed(
          1
        )}${unit}`
      );

      if (this.signal?.aborted) {
        clearInterval(interval);
        this.close();
      }
    }, 100);

    const tm = TaskManager.getInstance();
    const taskId = tm.run(task)[0];

    tm.onStatusChange(taskId, (status) => {
      if (status != "pending") {
        clearInterval(interval);
        this.close();
      }
    });
  }
}
