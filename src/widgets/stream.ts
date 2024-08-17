import { BaseTask, UI_SYMBOLS } from "..";
import color from "picocolors";

export class StreamTask extends BaseTask {
  rawText = "";
  initialMessage: string = "";
  statusSymbol = UI_SYMBOLS.BAR;
  stream(text: string) {
    this.rawText += text;
    const [firstLine, ...rest] = this.smartLineBreak(this.rawText).split("\n");    
    const formattedText = color.blue(firstLine) + 
      (rest.length > 0 ? "\n" + rest.map((line) => `${color.reset(UI_SYMBOLS.BAR)}  ${color.blue(line)}`).join("\n") : "");
    this.updateFn(formattedText);
  }

  smartLineBreak(text, maxLineLength = 120) {
    if (!text || typeof text !== "string") {
      return text;
    }

    const punctuationRegex = /[.,;:!?]\s/g;
    const lines = text.split("\n");
    let result = "";

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const words = line.split(/\s+/);
      let currentLine = "";

      for (let j = 0; j < words.length; j++) {
        const word = words[j];
        const newLine = currentLine ? `${currentLine} ${word}` : word;

        if (newLine.length <= maxLineLength) {
          currentLine = newLine;
        } else {
          const punctuationMatch = currentLine.match(punctuationRegex);
          if (punctuationMatch) {
            const punctuationIndex = currentLine.lastIndexOf(
              punctuationMatch[punctuationMatch.length - 1]
            );
            result += `${currentLine.slice(0, punctuationIndex + 2)}\n`;
            currentLine = currentLine.slice(punctuationIndex + 2) + ` ${word}`;
          } else {
            result += `${currentLine}\n`;
            currentLine = word;
          }
        }
      }

      if (currentLine) {
        result += currentLine;
      }

      if (i < lines.length - 1) {
        result += "\n";
      }
    }

    return result;
  }
}
