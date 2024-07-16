import { Task, strip, UI_SYMBOLS } from "..";
import color from "picocolors";
import { CodeColorizer } from "./code-colorizer.js";

export const code: (content, title) => Task = (content, title) => {
  const colorizer = new CodeColorizer();
  const lines = `\n${colorizer.colorFormat(content)}\n`.split("\n");
  const titleLen = strip(title).length;
  const len = Math.max(20, titleLen) + 5;
  const msg = lines.map((ln) => `  ${color.dim(ln)}`).join("\n");
  const output = `${color.reset(title)} ${color.gray(
    UI_SYMBOLS.BAR_H.repeat(Math.max(len - titleLen - 1, 1))
  )}\n${msg}\n${color.gray(
    UI_SYMBOLS.BAR_START + UI_SYMBOLS.BAR_H.repeat(len + 2)
  )}`;
  // try UI_SYMBOLS.CONNECT_LEFT

  return {
    initialMessage: "",
    task: async (updateFn, signal) => {
      updateFn(output);
    },
  };
};