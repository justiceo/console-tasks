import readline from "node:readline";
import color from "picocolors";
import { BaseTask, UI_SYMBOLS } from "..";

export class TextPrompt extends BaseTask {
  rl: readline.Interface;
  line: string;
  isFinalized = false;
  constructor(protected prompt: string, protected placeholder?: string) {
    super();
  }

  initialize() {
    // set up input from stdin.
    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    this.rl = readline.createInterface(process.stdin, null, undefined, true);
    process.stdin.on("keypress", () => this.updateUI());

    this.rl.on("line", this.onEnter);

    this.rl.on("SIGINT", () => {
      this.isFinalized = true;
      this.line = color.gray("<cancelled>");
      this.rl.close();
      this.close("Aborted");
    });

    // perform initial rendering.
    this.updateUI();
  }

  onEnter = (input) => {
    this.line = input;
    this.isFinalized = true;
    this.rl.close();
    this.close(input);
  };

  updateUI() {
    if (!this.isFinalized) {
      this.line = this.rl.line;
    }
    if (!this.line) {
      this.line = color.gray(this.placeholder);
    }
    this.updateFn(
      `${this.prompt}\n${UI_SYMBOLS.BAR}\n${UI_SYMBOLS.BAR}  ${this.line}${
        this.isFinalized ? "" : "\n" + UI_SYMBOLS.BAR_END
      }`
    );
  }
}
