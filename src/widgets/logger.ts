import { addMessage, UI_SYMBOLS } from "../task-api";
import color from "picocolors";

export class Logger {
  tag: string = "";
  enableDebug: boolean = false;

  constructor({ tag = "", enableDebug = false } = {}) {
    this.tag = tag;
    this.enableDebug = enableDebug;
  }

  _log(symbol, message) {
    addMessage(message, symbol);
  }

  debug(...args) {
    if (!this.enableDebug) {
      return;
    }
    // Format the log message with caller information
    const caller =`[${this.getCaller()}] `;
    const message = [caller, ...args];
    this._log(UI_SYMBOLS.INFO_STATUS, color.magenta(message.join("")));
  }  
  log(...args) {
    if (!this.enableDebug) {
      return;
    }
    this._log(UI_SYMBOLS.INFO_STATUS, args.join(" "));
  }
  error(...args) {
    this._log(UI_SYMBOLS.ERROR_STATUS, color.red(args.join(" ")));
  }
  warn(...args) {
    this._log(UI_SYMBOLS.WARN_STATUS, color.yellow(args.join(" ")));
  }
  info(...args) {
    this._log(UI_SYMBOLS.INFO_STATUS, color.blue(args.join(" ")));
  }

  /**
   * Get the caller information (file name or function name)
   * @returns {string} The caller information
   */
  getCaller() {
    const stackTraceRegex =
      /(?:at\s+)?(?:file:\/\/\/)?(?:.*?\/)?([^\/\s]+\.js):(\d+)(?::\d+)?/;

    const extractFileInfo = (stackTraceLine) => {
      const match = stackTraceLine.match(stackTraceRegex);
      if (match) {
        return {
          filename: match[1],
          lineNumber: parseInt(match[2], 10),
        };
      }
      return null;
    };

    const error = {};
    Error.captureStackTrace(error);
    // Index 4 contains the caller info.
    // NB: This index changes whenever the chain of calls from log to getCaller changes.
    const callerStack = error.stack.split("\n")[4];
    const fileInfo = extractFileInfo(callerStack);

    if (fileInfo) {
      return `${fileInfo.filename}:${fileInfo.lineNumber}`;
    }
    return "";
  }
}
