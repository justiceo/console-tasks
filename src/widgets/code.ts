import { Task, strip, UI_SYMBOLS } from "..";
import color from "picocolors";
export const code: (content, title) => Task = (content, title) => {
  const lines = `\n${content}`.split("\n");

  if (!title) {
    title = "";
  }
  const titleLen = strip(title).length;
  const len = Math.max(20, titleLen) + 5;
  // TODO: Apply color formatting if title is a language like "js" or "ts"
  const msg = lines.join("\n");
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
