import { erase, cursor } from 'sisteransi';
import color from 'picocolors';
import isUnicodeSupported from 'is-unicode-supported';

const unicode = isUnicodeSupported();
const s = (c: string, fallback: string) => (unicode ? c : fallback);
const S_STEP_ACTIVE = s('◆', '*');
const S_STEP_CANCEL = s('■', 'x');
const S_STEP_ERROR = s('▲', 'x');
const S_STEP_SUBMIT = s('◇', 'o');

const frames = unicode ? ['◒', '◐', '◓', '◑'] : ['•', 'o', 'O', '0'];

export interface Task {
  title: string;
  task: (message: (string: string) => void) => string | Promise<string> | void | Promise<void>;
  enabled?: boolean;
}

class MultiSpinner {
  private spinners: Map<string, {
    frame: number;
    message: string;
    status: 'pending' | 'success' | 'error';
  }> = new Map();
  private interval: NodeJS.Timeout | null = null;
  private previousRenderedLines: number = 0;

  constructor(private tasks: Task[]) {
    this.tasks.forEach((task, index) => {
      if (task.enabled !== false) {
        this.spinners.set(String(index), {
          frame: 0,
          message: task.title,
          status: 'pending'
        });
      }
    });
  }

  start() {
    process.stdout.write('\n');
    this.render();
    this.interval = setInterval(() => this.render(), 80);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.render();
    process.stdout.write('\n'); // Add a newline after all tasks are completed
  }

  update(index: number, message: string) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.message = message;
    }
  }

  succeed(index: number, message?: string) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.status = 'success';
      if (message) spinner.message = message;
    }
  }

  fail(index: number, message?: string) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.status = 'error';
      if (message) spinner.message = message;
    }
  }

  private render() {
    const output: string[] = [];

    for (const [, spinner] of this.spinners) {
      let symbol: string;
      switch (spinner.status) {
        case 'success':
          symbol = color.green(S_STEP_SUBMIT);
          break;
        case 'error':
          symbol = color.red(S_STEP_ERROR);
          break;
        default:
          symbol = color.magenta(frames[spinner.frame]);
          spinner.frame = (spinner.frame + 1) % frames.length;
      }
      output.push(`${symbol}  ${spinner.message}`);
    }

    // Move cursor to the start of the spinner area
    process.stdout.write(cursor.move(-999, -this.previousRenderedLines));
    
    // Erase the previous render
    process.stdout.write(erase.down());  // Fixed: Call erase.down() as a function

    // Write the new render
    process.stdout.write(output.join('\n'));

    // Update the number of lines we've rendered
    this.previousRenderedLines = output.length;

    // Move the cursor below the spinner area
    process.stdout.write(cursor.move(0, output.length));
  }
}

export const tasks = async (tasks: Task[]) => {
  const multiSpinner = new MultiSpinner(tasks);
  multiSpinner.start();

  try {
    await Promise.all(tasks.map(async (task, index) => {
      if (task.enabled === false) return;

      const updateMessage = (message: string) => {
        multiSpinner.update(index, message);
      };

      try {
        const result = await task.task(updateMessage);
        multiSpinner.succeed(index, result || task.title);
      } catch (error) {
        multiSpinner.fail(index, `${task.title} (Error: ${error.message})`);
      }
    }));
  } finally {
    multiSpinner.stop();
  }
};

// Helper function for creating delays (not part of the core implementation)
export function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}