import { Task, strip,UI_SYMBOLS } from "../task-api";
import color from "picocolors";

export const note: (message, title) => Task = (message, title) => {
  const lines = `\n${message}\n`.split("\n");
  const titleLen = strip(title).length;
  const len =
    Math.max(
      lines.reduce((sum, ln) => {
        ln = strip(ln);
        return ln.length > sum ? ln.length : sum;
      }, 0),
      titleLen
    ) + 2;
  const msg = lines
    .map(
      (ln) =>
        `${color.gray(UI_SYMBOLS.BAR)}  ${color.dim(ln)}${" ".repeat(
          len - strip(ln).length
        )}${color.gray(UI_SYMBOLS.BAR)}`
    )
    .join("\n");
  const output =
    `${color.reset(
      title
    )} ${color.gray(
      UI_SYMBOLS.BAR_H.repeat(Math.max(len - titleLen - 1, 1)) + UI_SYMBOLS.CORNER_TOP_RIGHT
    )}\n${msg}\n${color.gray(
      UI_SYMBOLS.CONNECT_LEFT + UI_SYMBOLS.BAR_H.repeat(len + 2) + UI_SYMBOLS.CORNER_BOTTOM_RIGHT
    )}`;
  return {
    initialMessage: "",
    task: async (updateFn, signal) => {
      updateFn(output);
    },
  };
};
