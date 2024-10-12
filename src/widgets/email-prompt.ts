import color from "picocolors";
import { TextPrompt } from "./text-prompt";
import { UI_SYMBOLS } from "..";

/**
 * EmailPrompt class extends the TextPrompt class to handle email-specific input.
 * It provides methods to validate and update the UI for email input.
 */
export class EmailPrompt extends TextPrompt {
  constructor(prompt: string, placeholder?: string) {
    super(prompt, placeholder);
  }

  onEnter = (input) => {
    // todo: Add email validation
    // todo: Update UI to show error message.
    this.line = "Email: " + input;
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
