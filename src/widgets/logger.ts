import { addMessage, UI_SYMBOLS } from "../tasks-api";
import color from "picocolors";

export class Logger {
  tag: string = "";
  enableDebug: boolean = false;

  constructor({ tag = "", enableDebug = false } = {}) {
    this.tag = tag;
    this.enableDebug = enableDebug;
  }

  _log(symbol, level, ...args) {    

    // Format the log message with caller information
    const caller = this.enableDebug ? `(at ${this.getCaller()})`: "";
    // TODO: Color the message based on the log level.
    const message = [level, caller, ...args];
    addMessage(message.join(" "), symbol);
  }

  debug(...args) {
    if (!this.enableDebug) {
      return;
    }
    this._log(UI_SYMBOLS.INFO_STATUS, "DEBUG", ...args);
  }  
  log(...args) {
    if (!this.enableDebug) {
      return;
    }
    this._log(UI_SYMBOLS.INFO_STATUS, "INFO", ...args);
  }
  error(...args) {
    this._log(UI_SYMBOLS.ERROR_STATUS, color.red("ERROR"), ...args);
  }
  warn(...args) {
    this._log(UI_SYMBOLS.WARN_STATUS, color.yellow("WARN"), ...args);
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
