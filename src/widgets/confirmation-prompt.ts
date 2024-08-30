import readline from "node:readline";
import color from "picocolors";
import { BaseTask, UI_SYMBOLS } from "../task-api";

export class ConfirmationPrompt extends BaseTask {
  isFinalized = false;
  isCancelled = false;
  rl: readline.Interface;
  constructor(
    private prompt: string,
    private confirmText = " Yes ",
    private declineText = " No ",
    private hasDeclined = false
  ) {
    super();
  }

  initialize() {
    // set up input from stdin.
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    this.rl = readline.createInterface(process.stdin);
    process.stdin.on("keypress", this.keyPressHandler);

    this.signal?.addEventListener("abort", () => {
      this.rl.close();
      this.close(false);
    });

    // perform initial rendering.
    this.updateUI();
  }

  keyPressHandler = (chunk, key) => {
    if (key?.name === "return") {
      this.finalize();
    } else if (key?.name === "y") {
      this.hasDeclined = false;
      this.finalize();
    } else if (key?.name === "n") {
      this.hasDeclined = true;
      this.finalize();
    } else if (key?.name === "tab") {
      this.hasDeclined = !this.hasDeclined;
      this.updateUI();
    } else if (key?.name === "left") {
      this.hasDeclined = false;
      this.updateUI();
    } else if (key?.name === "right") {
      this.hasDeclined = true;
      this.updateUI();
    } else if ((key?.name === "c" || key?.name === "d") && key.ctrl) {
      this.isCancelled = true;
      this.rl.close();
      this.updateUI();
      this.close("Aborted");
    } else {
      // Show notification for invalid key press.
    }
  };

  finalize() {
    this.isFinalized = true;
    process.stdin.removeListener("keypress", this.keyPressHandler);
    process.stdin.setRawMode(false);
    this.rl.close();

    this.updateUI();
    this.close(!this.hasDeclined);
  }

  updateUI() {
    const pendingOptions = this.hasDeclined
      ? this.confirmText + " / " + color.bgRed(this.declineText)
      : color.bgGreen(this.confirmText) + " / " + this.declineText;

    const resolvedOptions = this.hasDeclined
      ? color.bgRed(this.declineText)
      : color.bgGreen(this.confirmText);

    const cancelled = color.inverse(" cancelled ");

    const renderedOptions = this.isCancelled
      ? cancelled
      : this.isFinalized
      ? resolvedOptions
      : pendingOptions;
    this.updateFn(`${this.prompt}\n${UI_SYMBOLS.BAR}  ${renderedOptions}`);
  }
}
