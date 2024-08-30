

/**
 * Checks if Unicode is supported in the current environment.
 * From https://www.npmjs.com/package/is-unicode-supported
 * @returns True if Unicode is supported, false otherwise.
 */
export function isUnicodeSupported(): boolean {
    if (process.platform !== "win32") {
      return process.env.TERM !== "linux"; // Linux console (kernel)
    }
  
    const env = process.env;
    return Boolean(
      env.WT_SESSION || // Windows Terminal
        env.TERMINUS_SUBLIME || // Terminus (<0.2.27)
        env.ConEmuTask === "{cmd::Cmder}" || // ConEmu and cmder
        env.TERM_PROGRAM === "Terminus-Sublime" ||
        env.TERM_PROGRAM === "vscode" ||
        env.TERM === "xterm-256color" ||
        env.TERM === "alacritty" ||
        env.TERMINAL_EMULATOR === "JetBrains-JediTerm"
    );
  }
  
  /**
   * Regular expression for matching ANSI escape codes.
   * Adapted from https://github.com/chalk/ansi-regex
   * @see LICENSE
   */
  export function ansiRegex() {
    const pattern = [
      "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
      "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))",
    ].join("|");
  
    return new RegExp(pattern, "g");
  }
  
  /**
   * Strips ANSI escape codes from a string.
   * @param str The string to strip.
   * @returns The string without ANSI escape codes.
   */
  export const strip = (str: string) => str.replace(ansiRegex(), "");