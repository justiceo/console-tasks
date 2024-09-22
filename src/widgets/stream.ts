import { BaseTask, UI_SYMBOLS } from "..";
import color from "picocolors";

interface Hook {
  startSequence: string;
  endSequence: string;
  callback: (event: "chunk" | "end", data?: string) => string;
}

export class StreamTask extends BaseTask {
  rawText = "";
  initialMessage: string = "";
  statusSymbol = UI_SYMBOLS.BAR;
  activeLine = false;
  hooks: Map<string, Hook> = new Map(); // Using Map for single hook per startSequence
  processedSequences: Map<string, string> = new Map();

  addHook(hook: Hook) {
    this.hooks.set(hook.startSequence, hook);
  }

  processHooks(text: string): string {
    let processedText = text;

    for (const [startSequence, hook] of this.hooks.entries()) {
      let startIndex = processedText.indexOf(hook.startSequence);

      // Continue processing while we keep finding startSequence in the text
      while (startIndex !== -1) {
        const endIndex = processedText.indexOf(
          hook.endSequence,
          startIndex + hook.startSequence.length
        );

        if (endIndex === -1) {
          // Only start sequence found (partial match)
          const chunkData = processedText.slice(
            startIndex + hook.startSequence.length
          );
          const processedChunk = hook.callback("chunk", chunkData);
          processedText = processedText.slice(0, startIndex) + processedChunk;
        } else {
          // Both start and end sequences found
          const innerData = processedText.slice(
            startIndex + hook.startSequence.length,
            endIndex
          );
          const sequenceKey = `${startIndex}-${endIndex}-${hook.startSequence}-${hook.endSequence}`;

          let processedData: string;
          if (this.processedSequences.has(sequenceKey)) {
            processedData = this.processedSequences.get(sequenceKey)!;
          } else {
            processedData = hook.callback("end", innerData);
            this.processedSequences.set(sequenceKey, processedData);
          }

          // Replace the original text with processed data
          processedText =
            processedText.slice(0, startIndex) +
            processedData +
            processedText.slice(endIndex + hook.endSequence.length);
        }

        // Continue searching for the next occurrence of the startSequence
        startIndex = processedText.indexOf(
          hook.startSequence,
          startIndex + hook.startSequence.length
        );
      }
    }

    return processedText;
  }

  stream(text: string) {
    this.rawText += (this.activeLine ? "\n\n" : "") + text;
    this.activeLine = false;
    const width = Math.min(process.stdout.columns ?? 80, 50);
    const processedText = this.processHooks(this.rawText);
    this.updateFn(this.multiLineFormat(processedText, width));
  }

  streamln(text: string) {
    // TODO: Fix the issue of two streamln calls in a row having an extra newline in between them.
    if (this.rawText) {
      this.stream("\n" + text); // This is the problem, as it modifies activeLine.
    } else {
      this.stream(text);
    }
    this.activeLine = true;
  }

  multiLineFormat(text, width = process.stdout.columns, txtColor = "reset") {
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

  getLines(inputString, displayWidth) {
    // Split the input string by newline characters
    const originalLines = inputString.split('\n');
    const result = [];
  
    for (let line of originalLines) {  
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

  // @deprecated
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

        if (newLine.length <= maxLineLength - 5) {
          // allow space for left bars and tabs
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
            if (lastSoftBreak >= (maxLineLength * 3) / 4) {
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
