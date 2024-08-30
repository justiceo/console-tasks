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
      `${this.prompt}\n${UI_SYMBOLS.BAR}\n${
        UI_SYMBOLS.BAR
      }  ${this.multiLineFormat(this.line)}${
        this.isFinalized
          ? ""
          : "\n" + UI_SYMBOLS.CONNECT_LEFT + UI_SYMBOLS.BAR_H
      }`
    );
  }

  multiLineFormat(
    text,
    width = process.stdout.columns - 10,
    txtColor = "reset"
  ) {
    const [firstLine, ...rest] = this.getLines(text, width);
    const formattedText =
      color[txtColor](firstLine) +
      (rest.length > 0
        ? "\n" +
          rest
            .map(
              (line) =>
                `${color.reset(UI_SYMBOLS.BAR)}  ${color[txtColor](line)}`
            )
            .join("\n")
        : "");
    return formattedText;
  }

  // Breaks input string into lines that fit within the display width.
  getLines(inputString, displayWidth) {
    // Split the input string by newline characters
    const originalLines = inputString.split('\n');
    const result = [];
  
    for (let line of originalLines) {
      line = line.trim();
  
      // If a line is empty or shorter than the width, add it as is
      if (line.length <= displayWidth) {
        result.push(line);
        continue;
      }
  
      // Wrap the line if it's longer than the width
      let remainingText = line;
      while (remainingText.length > displayWidth) {
        // Find the last space within the width
        let breakIndex = remainingText.lastIndexOf(' ', displayWidth);
  
        // If no space found, break at the width
        if (breakIndex === -1) {
          breakIndex = displayWidth;
        }
  
        // Add the wrapped portion to the result
        result.push(remainingText.slice(0, breakIndex).trim());
  
        // Update the remaining text
        remainingText = remainingText.slice(breakIndex).trim();
      }
  
      // Add any remaining text as the last line
      if (remainingText.length > 0) {
        result.push(remainingText);
      }
    }
  
    return result;
  }
}
