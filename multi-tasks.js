import { erase, cursor } from "sisteransi";
import color from "picocolors";
import isUnicodeSupported from "is-unicode-supported";
const unicode = isUnicodeSupported();
const s = (c, fallback) => unicode ? c : fallback;
const S_STEP_ACTIVE = s("\u25C6", "*");
const S_STEP_CANCEL = s("\u25A0", "x");
const S_STEP_ERROR = s("\u25B2", "x");
const S_STEP_SUBMIT = s("\u25C7", "o");
const frames = unicode ? ["\u25D2", "\u25D0", "\u25D3", "\u25D1"] : ["\u2022", "o", "O", "0"];
class MultiSpinner {
  constructor(tasks2) {
    this.tasks = tasks2;
    this.tasks.forEach((task, index) => {
      if (task.enabled !== false) {
        this.spinners.set(String(index), {
          frame: 0,
          message: task.title,
          status: "pending"
        });
      }
    });
  }
  spinners = /* @__PURE__ */ new Map();
  interval = null;
  previousRenderedLines = 0;
  start() {
    process.stdout.write("\n");
    this.render();
    this.interval = setInterval(() => this.render(), 80);
  }
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
    }
    this.render();
    process.stdout.write("\n");
  }
  update(index, message) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.message = message;
    }
  }
  succeed(index, message) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.status = "success";
      if (message) spinner.message = message;
    }
  }
  fail(index, message) {
    const spinner = this.spinners.get(String(index));
    if (spinner) {
      spinner.status = "error";
      if (message) spinner.message = message;
    }
  }
  render() {
    const output = [];
    for (const [, spinner] of this.spinners) {
      let symbol;
      switch (spinner.status) {
        case "success":
          symbol = color.green(S_STEP_SUBMIT);
          break;
        case "error":
          symbol = color.red(S_STEP_ERROR);
          break;
        default:
          symbol = color.magenta(frames[spinner.frame]);
          spinner.frame = (spinner.frame + 1) % frames.length;
      }
      output.push(`${symbol}  ${spinner.message}`);
    }
    process.stdout.write(cursor.move(-999, -this.previousRenderedLines));
    process.stdout.write(erase.down());
    process.stdout.write(output.join("\n"));
    this.previousRenderedLines = output.length;
    process.stdout.write(cursor.move(0, output.length));
  }
}
export const tasks = async (tasks2) => {
  const multiSpinner = new MultiSpinner(tasks2);
  multiSpinner.start();
  try {
    await Promise.all(tasks2.map(async (task, index) => {
      if (task.enabled === false) return;
      const updateMessage = (message) => {
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
export function sleep(seconds) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1e3));
}
