import { BaseTask, UI_SYMBOLS } from "..";
import color from "picocolors";

export class StreamTask extends BaseTask {
  rawText = "";
  initialMessage: string = "";
  statusSymbol = UI_SYMBOLS.BAR;
  stream(text: string) {
    this.rawText += text;
    const width = Math.min(process.stdout.columns ?? 80, 50);
    const [firstLine, ...rest] = this.smartLineBreak(this.rawText, width).split(
      "\n"
    );
    const formattedText =
      color.blue(firstLine) +
      (rest.length > 0
        ? "\n" +
          rest
            .map(
              (line) => `${color.reset(UI_SYMBOLS.BAR)}  ${color.blue(line)}`
            )
            .join("\n")
        : "");
    this.updateFn(formattedText);
  }

  smartLineBreak(text, maxLineLength = 120) {
    if (!text || typeof text !== "string") {
      return text;
    }
  
    const hardBreakerRegex = /[.!?]\s/g;
    const softBreakerRegex = /[,;:]\s/g;
    const lines = text.split("\n");
    let result = "";
  
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const words = line.split(/\s+/);
      let currentLine = "";
  
      for (let j = 0; j < words.length; j++) {
        const word = words[j];
        const newLine = currentLine ? `${currentLine} ${word}` : word;
  
        if (newLine.length <= maxLineLength - 5) { // allow space for left bars and tabs
          currentLine = newLine;
        } else {
          const hardBreakMatch = currentLine.match(hardBreakerRegex);
          const softBreakMatch = currentLine.match(softBreakerRegex);
  
          let breakIndex = -1;
  
          if (hardBreakMatch) {
            const lastHardBreak = currentLine.lastIndexOf(
              hardBreakMatch[hardBreakMatch.length - 1]
            );
  
            // Check if the hard breaker is after the midpoint of the max line length
            if (lastHardBreak >= maxLineLength / 2) {
              breakIndex = lastHardBreak;
            }
          } 
  
          if (breakIndex === -1 && softBreakMatch) {
            const lastSoftBreak = currentLine.lastIndexOf(
              softBreakMatch[softBreakMatch.length - 1]
            );
  
            // Check if the soft breaker is after 3/4 of the max line length
            if (lastSoftBreak >= maxLineLength * 3 / 4) {
              breakIndex = lastSoftBreak;
            }
          }
  
          if (breakIndex !== -1) {
            result += `${currentLine.slice(0, breakIndex + 2)}\n`;
            currentLine = currentLine.slice(breakIndex + 2) + ` ${word}`;
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
