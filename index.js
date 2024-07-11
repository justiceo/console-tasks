import {
  block,
  ConfirmPrompt,
  GroupMultiSelectPrompt,
  isCancel,
  MultiSelectPrompt,
  PasswordPrompt,
  SelectKeyPrompt,
  SelectPrompt,
  TextPrompt
} from "@clack/core";
import isUnicodeSupported from "is-unicode-supported";
import color from "picocolors";
import { cursor, erase } from "sisteransi";
export { isCancel } from "@clack/core";
const unicode = isUnicodeSupported();
const s = (c, fallback) => unicode ? c : fallback;
const S_STEP_ACTIVE = s("\u25C6", "*");
const S_STEP_CANCEL = s("\u25A0", "x");
const S_STEP_ERROR = s("\u25B2", "x");
const S_STEP_SUBMIT = s("\u25C7", "o");
const S_BAR_START = s("\u250C", "T");
const S_BAR = s("\u2502", "|");
const S_BAR_END = s("\u2514", "\u2014");
const S_RADIO_ACTIVE = s("\u25CF", ">");
const S_RADIO_INACTIVE = s("\u25CB", " ");
const S_CHECKBOX_ACTIVE = s("\u25FB", "[\u2022]");
const S_CHECKBOX_SELECTED = s("\u25FC", "[+]");
const S_CHECKBOX_INACTIVE = s("\u25FB", "[ ]");
const S_PASSWORD_MASK = s("\u25AA", "\u2022");
const S_BAR_H = s("\u2500", "-");
const S_CORNER_TOP_RIGHT = s("\u256E", "+");
const S_CONNECT_LEFT = s("\u251C", "+");
const S_CORNER_BOTTOM_RIGHT = s("\u256F", "+");
const S_INFO = s("\u25CF", "\u2022");
const S_SUCCESS = s("\u25C6", "*");
const S_WARN = s("\u25B2", "!");
const S_ERROR = s("\u25A0", "x");
const symbol = (state) => {
  switch (state) {
    case "initial":
    case "active":
      return color.cyan(S_STEP_ACTIVE);
    case "cancel":
      return color.red(S_STEP_CANCEL);
    case "error":
      return color.yellow(S_STEP_ERROR);
    case "submit":
      return color.green(S_STEP_SUBMIT);
  }
};
const limitOptions = (params) => {
  const { cursor: cursor2, options, style } = params;
  const paramMaxItems = params.maxItems ?? Infinity;
  const outputMaxItems = Math.max(process.stdout.rows - 4, 0);
  const maxItems = Math.min(outputMaxItems, Math.max(paramMaxItems, 5));
  let slidingWindowLocation = 0;
  if (cursor2 >= slidingWindowLocation + maxItems - 3) {
    slidingWindowLocation = Math.max(Math.min(cursor2 - maxItems + 3, options.length - maxItems), 0);
  } else if (cursor2 < slidingWindowLocation + 2) {
    slidingWindowLocation = Math.max(cursor2 - 2, 0);
  }
  const shouldRenderTopEllipsis = maxItems < options.length && slidingWindowLocation > 0;
  const shouldRenderBottomEllipsis = maxItems < options.length && slidingWindowLocation + maxItems < options.length;
  return options.slice(slidingWindowLocation, slidingWindowLocation + maxItems).map((option, i, arr) => {
    const isTopLimit = i === 0 && shouldRenderTopEllipsis;
    const isBottomLimit = i === arr.length - 1 && shouldRenderBottomEllipsis;
    return isTopLimit || isBottomLimit ? color.dim("...") : style(option, i + slidingWindowLocation === cursor2);
  });
};
export const text = (opts) => {
  return new TextPrompt({
    validate: opts.validate,
    placeholder: opts.placeholder,
    defaultValue: opts.defaultValue,
    initialValue: opts.initialValue,
    render() {
      const title = `${color.gray(S_BAR)}
${symbol(this.state)}  ${opts.message}
`;
      const placeholder = opts.placeholder ? color.inverse(opts.placeholder[0]) + color.dim(opts.placeholder.slice(1)) : color.inverse(color.hidden("_"));
      const value = !this.value ? placeholder : this.valueWithCursor;
      switch (this.state) {
        case "error":
          return `${title.trim()}
${color.yellow(S_BAR)}  ${value}
${color.yellow(
            S_BAR_END
          )}  ${color.yellow(this.error)}
`;
        case "submit":
          return `${title}${color.gray(S_BAR)}  ${color.dim(this.value || opts.placeholder)}`;
        case "cancel":
          return `${title}${color.gray(S_BAR)}  ${color.strikethrough(
            color.dim(this.value ?? "")
          )}${this.value?.trim() ? "\n" + color.gray(S_BAR) : ""}`;
        default:
          return `${title}${color.cyan(S_BAR)}  ${value}
${color.cyan(S_BAR_END)}
`;
      }
    }
  }).prompt();
};
export const password = (opts) => {
  return new PasswordPrompt({
    validate: opts.validate,
    mask: opts.mask ?? S_PASSWORD_MASK,
    render() {
      const title = `${color.gray(S_BAR)}
${symbol(this.state)}  ${opts.message}
`;
      const value = this.valueWithCursor;
      const masked = this.masked;
      switch (this.state) {
        case "error":
          return `${title.trim()}
${color.yellow(S_BAR)}  ${masked}
${color.yellow(
            S_BAR_END
          )}  ${color.yellow(this.error)}
`;
        case "submit":
          return `${title}${color.gray(S_BAR)}  ${color.dim(masked)}`;
        case "cancel":
          return `${title}${color.gray(S_BAR)}  ${color.strikethrough(color.dim(masked ?? ""))}${masked ? "\n" + color.gray(S_BAR) : ""}`;
        default:
          return `${title}${color.cyan(S_BAR)}  ${value}
${color.cyan(S_BAR_END)}
`;
      }
    }
  }).prompt();
};
export const confirm = (opts) => {
  const active = opts.active ?? "Yes";
  const inactive = opts.inactive ?? "No";
  return new ConfirmPrompt({
    active,
    inactive,
    initialValue: opts.initialValue ?? true,
    render() {
      const title = `${color.gray(S_BAR)}
${symbol(this.state)}  ${opts.message}
`;
      const value = this.value ? active : inactive;
      switch (this.state) {
        case "submit":
          return `${title}${color.gray(S_BAR)}  ${color.dim(value)}`;
        case "cancel":
          return `${title}${color.gray(S_BAR)}  ${color.strikethrough(
            color.dim(value)
          )}
${color.gray(S_BAR)}`;
        default: {
          return `${title}${color.cyan(S_BAR)}  ${this.value ? `${color.green(S_RADIO_ACTIVE)} ${active}` : `${color.dim(S_RADIO_INACTIVE)} ${color.dim(active)}`} ${color.dim("/")} ${!this.value ? `${color.green(S_RADIO_ACTIVE)} ${inactive}` : `${color.dim(S_RADIO_INACTIVE)} ${color.dim(inactive)}`}
${color.cyan(S_BAR_END)}
`;
        }
      }
    }
  }).prompt();
};
export const select = (opts) => {
  const opt = (option, state) => {
    const label = option.label ?? String(option.value);
    switch (state) {
      case "selected":
        return `${color.dim(label)}`;
      case "active":
        return `${color.green(S_RADIO_ACTIVE)} ${label} ${option.hint ? color.dim(`(${option.hint})`) : ""}`;
      case "cancelled":
        return `${color.strikethrough(color.dim(label))}`;
      default:
        return `${color.dim(S_RADIO_INACTIVE)} ${color.dim(label)}`;
    }
  };
  return new SelectPrompt({
    options: opts.options,
    initialValue: opts.initialValue,
    render() {
      const title = `${color.gray(S_BAR)}
${symbol(this.state)}  ${opts.message}
`;
      switch (this.state) {
        case "submit":
          return `${title}${color.gray(S_BAR)}  ${opt(this.options[this.cursor], "selected")}`;
        case "cancel":
          return `${title}${color.gray(S_BAR)}  ${opt(
            this.options[this.cursor],
            "cancelled"
          )}
${color.gray(S_BAR)}`;
        default: {
          return `${title}${color.cyan(S_BAR)}  ${limitOptions({
            cursor: this.cursor,
            options: this.options,
            maxItems: opts.maxItems,
            style: (item, active) => opt(item, active ? "active" : "inactive")
          }).join(`
${color.cyan(S_BAR)}  `)}
${color.cyan(S_BAR_END)}
`;
        }
      }
    }
  }).prompt();
};
export const selectKey = (opts) => {
  const opt = (option, state = "inactive") => {
    const label = option.label ?? String(option.value);
    if (state === "selected") {
      return `${color.dim(label)}`;
    } else if (state === "cancelled") {
      return `${color.strikethrough(color.dim(label))}`;
    } else if (state === "active") {
      return `${color.bgCyan(color.gray(` ${option.value} `))} ${label} ${option.hint ? color.dim(`(${option.hint})`) : ""}`;
    }
    return `${color.gray(color.bgWhite(color.inverse(` ${option.value} `)))} ${label} ${option.hint ? color.dim(`(${option.hint})`) : ""}`;
  };
  return new SelectKeyPrompt({
    options: opts.options,
    initialValue: opts.initialValue,
    render() {
      const title = `${color.gray(S_BAR)}
${symbol(this.state)}  ${opts.message}
`;
      switch (this.state) {
        case "submit":
          return `${title}${color.gray(S_BAR)}  ${opt(
            this.options.find((opt2) => opt2.value === this.value),
            "selected"
          )}`;
        case "cancel":
          return `${title}${color.gray(S_BAR)}  ${opt(this.options[0], "cancelled")}
${color.gray(
            S_BAR
          )}`;
        default: {
          return `${title}${color.cyan(S_BAR)}  ${this.options.map((option, i) => opt(option, i === this.cursor ? "active" : "inactive")).join(`
${color.cyan(S_BAR)}  `)}
${color.cyan(S_BAR_END)}
`;
        }
      }
    }
  }).prompt();
};
export const multiselect = (opts) => {
  const opt = (option, state) => {
    const label = option.label ?? String(option.value);
    if (state === "active") {
      return `${color.cyan(S_CHECKBOX_ACTIVE)} ${label} ${option.hint ? color.dim(`(${option.hint})`) : ""}`;
    } else if (state === "selected") {
      return `${color.green(S_CHECKBOX_SELECTED)} ${color.dim(label)}`;
    } else if (state === "cancelled") {
      return `${color.strikethrough(color.dim(label))}`;
    } else if (state === "active-selected") {
      return `${color.green(S_CHECKBOX_SELECTED)} ${label} ${option.hint ? color.dim(`(${option.hint})`) : ""}`;
    } else if (state === "submitted") {
      return `${color.dim(label)}`;
    }
    return `${color.dim(S_CHECKBOX_INACTIVE)} ${color.dim(label)}`;
  };
  return new MultiSelectPrompt({
    options: opts.options,
    initialValues: opts.initialValues,
    required: opts.required ?? true,
    cursorAt: opts.cursorAt,
    validate(selected) {
      if (this.required && selected.length === 0)
        return `Please select at least one option.
${color.reset(
          color.dim(
            `Press ${color.gray(color.bgWhite(color.inverse(" space ")))} to select, ${color.gray(
              color.bgWhite(color.inverse(" enter "))
            )} to submit`
          )
        )}`;
    },
    render() {
      let title = `${color.gray(S_BAR)}
${symbol(this.state)}  ${opts.message}
`;
      const styleOption = (option, active) => {
        const selected = this.value.includes(option.value);
        if (active && selected) {
          return opt(option, "active-selected");
        }
        if (selected) {
          return opt(option, "selected");
        }
        return opt(option, active ? "active" : "inactive");
      };
      switch (this.state) {
        case "submit": {
          return `${title}${color.gray(S_BAR)}  ${this.options.filter(({ value }) => this.value.includes(value)).map((option) => opt(option, "submitted")).join(color.dim(", ")) || color.dim("none")}`;
        }
        case "cancel": {
          const label = this.options.filter(({ value }) => this.value.includes(value)).map((option) => opt(option, "cancelled")).join(color.dim(", "));
          return `${title}${color.gray(S_BAR)}  ${label.trim() ? `${label}
${color.gray(S_BAR)}` : ""}`;
        }
        case "error": {
          const footer = this.error.split("\n").map(
            (ln, i) => i === 0 ? `${color.yellow(S_BAR_END)}  ${color.yellow(ln)}` : `   ${ln}`
          ).join("\n");
          return title + color.yellow(S_BAR) + "  " + limitOptions({
            options: this.options,
            cursor: this.cursor,
            maxItems: opts.maxItems,
            style: styleOption
          }).join(`
${color.yellow(S_BAR)}  `) + "\n" + footer + "\n";
        }
        default: {
          return `${title}${color.cyan(S_BAR)}  ${limitOptions({
            options: this.options,
            cursor: this.cursor,
            maxItems: opts.maxItems,
            style: styleOption
          }).join(`
${color.cyan(S_BAR)}  `)}
${color.cyan(S_BAR_END)}
`;
        }
      }
    }
  }).prompt();
};
export const groupMultiselect = (opts) => {
  const opt = (option, state, options = []) => {
    const label = option.label ?? String(option.value);
    const isItem = typeof option.group === "string";
    const next = isItem && (options[options.indexOf(option) + 1] ?? { group: true });
    const isLast = isItem && next.group === true;
    const prefix = isItem ? `${isLast ? S_BAR_END : S_BAR} ` : "";
    if (state === "active") {
      return `${color.dim(prefix)}${color.cyan(S_CHECKBOX_ACTIVE)} ${label} ${option.hint ? color.dim(`(${option.hint})`) : ""}`;
    } else if (state === "group-active") {
      return `${prefix}${color.cyan(S_CHECKBOX_ACTIVE)} ${color.dim(label)}`;
    } else if (state === "group-active-selected") {
      return `${prefix}${color.green(S_CHECKBOX_SELECTED)} ${color.dim(label)}`;
    } else if (state === "selected") {
      return `${color.dim(prefix)}${color.green(S_CHECKBOX_SELECTED)} ${color.dim(label)}`;
    } else if (state === "cancelled") {
      return `${color.strikethrough(color.dim(label))}`;
    } else if (state === "active-selected") {
      return `${color.dim(prefix)}${color.green(S_CHECKBOX_SELECTED)} ${label} ${option.hint ? color.dim(`(${option.hint})`) : ""}`;
    } else if (state === "submitted") {
      return `${color.dim(label)}`;
    }
    return `${color.dim(prefix)}${color.dim(S_CHECKBOX_INACTIVE)} ${color.dim(label)}`;
  };
  return new GroupMultiSelectPrompt({
    options: opts.options,
    initialValues: opts.initialValues,
    required: opts.required ?? true,
    cursorAt: opts.cursorAt,
    validate(selected) {
      if (this.required && selected.length === 0)
        return `Please select at least one option.
${color.reset(
          color.dim(
            `Press ${color.gray(color.bgWhite(color.inverse(" space ")))} to select, ${color.gray(
              color.bgWhite(color.inverse(" enter "))
            )} to submit`
          )
        )}`;
    },
    render() {
      let title = `${color.gray(S_BAR)}
${symbol(this.state)}  ${opts.message}
`;
      switch (this.state) {
        case "submit": {
          return `${title}${color.gray(S_BAR)}  ${this.options.filter(({ value }) => this.value.includes(value)).map((option) => opt(option, "submitted")).join(color.dim(", "))}`;
        }
        case "cancel": {
          const label = this.options.filter(({ value }) => this.value.includes(value)).map((option) => opt(option, "cancelled")).join(color.dim(", "));
          return `${title}${color.gray(S_BAR)}  ${label.trim() ? `${label}
${color.gray(S_BAR)}` : ""}`;
        }
        case "error": {
          const footer = this.error.split("\n").map(
            (ln, i) => i === 0 ? `${color.yellow(S_BAR_END)}  ${color.yellow(ln)}` : `   ${ln}`
          ).join("\n");
          return `${title}${color.yellow(S_BAR)}  ${this.options.map((option, i, options) => {
            const selected = this.value.includes(option.value) || option.group === true && this.isGroupSelected(`${option.value}`);
            const active = i === this.cursor;
            const groupActive = !active && typeof option.group === "string" && this.options[this.cursor].value === option.group;
            if (groupActive) {
              return opt(option, selected ? "group-active-selected" : "group-active", options);
            }
            if (active && selected) {
              return opt(option, "active-selected", options);
            }
            if (selected) {
              return opt(option, "selected", options);
            }
            return opt(option, active ? "active" : "inactive", options);
          }).join(`
${color.yellow(S_BAR)}  `)}
${footer}
`;
        }
        default: {
          return `${title}${color.cyan(S_BAR)}  ${this.options.map((option, i, options) => {
            const selected = this.value.includes(option.value) || option.group === true && this.isGroupSelected(`${option.value}`);
            const active = i === this.cursor;
            const groupActive = !active && typeof option.group === "string" && this.options[this.cursor].value === option.group;
            if (groupActive) {
              return opt(option, selected ? "group-active-selected" : "group-active", options);
            }
            if (active && selected) {
              return opt(option, "active-selected", options);
            }
            if (selected) {
              return opt(option, "selected", options);
            }
            return opt(option, active ? "active" : "inactive", options);
          }).join(`
${color.cyan(S_BAR)}  `)}
${color.cyan(S_BAR_END)}
`;
        }
      }
    }
  }).prompt();
};
const strip = (str) => str.replace(ansiRegex(), "");
export const note = (message = "", title = "") => {
  const lines = `
${message}
`.split("\n");
  const titleLen = strip(title).length;
  const len = Math.max(
    lines.reduce((sum, ln) => {
      ln = strip(ln);
      return ln.length > sum ? ln.length : sum;
    }, 0),
    titleLen
  ) + 2;
  const msg = lines.map(
    (ln) => `${color.gray(S_BAR)}  ${color.dim(ln)}${" ".repeat(len - strip(ln).length)}${color.gray(
      S_BAR
    )}`
  ).join("\n");
  process.stdout.write(
    `${color.gray(S_BAR)}
${color.green(S_STEP_SUBMIT)}  ${color.reset(title)} ${color.gray(
      S_BAR_H.repeat(Math.max(len - titleLen - 1, 1)) + S_CORNER_TOP_RIGHT
    )}
${msg}
${color.gray(S_CONNECT_LEFT + S_BAR_H.repeat(len + 2) + S_CORNER_BOTTOM_RIGHT)}
`
  );
};
export const cancel = (message = "") => {
  process.stdout.write(`${color.gray(S_BAR_END)}  ${color.red(message)}

`);
};
export const intro = (title = "") => {
  process.stdout.write(`${color.gray(S_BAR_START)}  ${title}
`);
};
export const outro = (message = "") => {
  process.stdout.write(`${color.gray(S_BAR)}
${color.gray(S_BAR_END)}  ${message}

`);
};
export const log = {
  message: (message = "", { symbol: symbol2 = color.gray(S_BAR) } = {}) => {
    const parts = [`${color.gray(S_BAR)}`];
    if (message) {
      const [firstLine, ...lines] = message.split("\n");
      parts.push(`${symbol2}  ${firstLine}`, ...lines.map((ln) => `${color.gray(S_BAR)}  ${ln}`));
    }
    process.stdout.write(`${parts.join("\n")}
`);
  },
  info: (message) => {
    log.message(message, { symbol: color.blue(S_INFO) });
  },
  success: (message) => {
    log.message(message, { symbol: color.green(S_SUCCESS) });
  },
  step: (message) => {
    log.message(message, { symbol: color.green(S_STEP_SUBMIT) });
  },
  warn: (message) => {
    log.message(message, { symbol: color.yellow(S_WARN) });
  },
  /** alias for `log.warn()`. */
  warning: (message) => {
    log.warn(message);
  },
  error: (message) => {
    log.message(message, { symbol: color.red(S_ERROR) });
  }
};
export const spinner = () => {
  const frames = unicode ? ["\u25D2", "\u25D0", "\u25D3", "\u25D1"] : ["\u2022", "o", "O", "0"];
  const delay = unicode ? 80 : 120;
  let unblock;
  let loop;
  let isSpinnerActive = false;
  let _message = "";
  const handleExit = (code) => {
    const msg = code > 1 ? "Something went wrong" : "Canceled";
    if (isSpinnerActive) stop(msg, code);
  };
  const errorEventHandler = () => handleExit(2);
  const signalEventHandler = () => handleExit(1);
  const registerHooks = () => {
    process.on("uncaughtExceptionMonitor", errorEventHandler);
    process.on("unhandledRejection", errorEventHandler);
    process.on("SIGINT", signalEventHandler);
    process.on("SIGTERM", signalEventHandler);
    process.on("exit", handleExit);
  };
  const clearHooks = () => {
    process.removeListener("uncaughtExceptionMonitor", errorEventHandler);
    process.removeListener("unhandledRejection", errorEventHandler);
    process.removeListener("SIGINT", signalEventHandler);
    process.removeListener("SIGTERM", signalEventHandler);
    process.removeListener("exit", handleExit);
  };
  const start = (msg = "") => {
    isSpinnerActive = true;
    unblock = block();
    _message = msg.replace(/\.+$/, "");
    process.stdout.write(`${color.gray(S_BAR)}
`);
    let frameIndex = 0;
    let dotsTimer = 0;
    registerHooks();
    loop = setInterval(() => {
      const frame = color.magenta(frames[frameIndex]);
      const loadingDots = ".".repeat(Math.floor(dotsTimer)).slice(0, 3);
      process.stdout.write(cursor.move(-999, 0));
      process.stdout.write(erase.down(1));
      process.stdout.write(`${frame}  ${_message}${loadingDots}`);
      frameIndex = frameIndex + 1 < frames.length ? frameIndex + 1 : 0;
      dotsTimer = dotsTimer < frames.length ? dotsTimer + 0.125 : 0;
    }, delay);
  };
  const stop = (msg = "", code = 0) => {
    _message = msg ?? _message;
    isSpinnerActive = false;
    clearInterval(loop);
    const step = code === 0 ? color.green(S_STEP_SUBMIT) : code === 1 ? color.red(S_STEP_CANCEL) : color.red(S_STEP_ERROR);
    process.stdout.write(cursor.move(-999, 0));
    process.stdout.write(erase.down(1));
    process.stdout.write(`${step}  ${_message}
`);
    clearHooks();
    unblock();
  };
  const message = (msg = "") => {
    _message = msg ?? _message;
  };
  return {
    start,
    stop,
    message
  };
};
function ansiRegex() {
  const pattern = [
    "[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)",
    "(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))"
  ].join("|");
  return new RegExp(pattern, "g");
}
export const group = async (prompts, opts) => {
  const results = {};
  const promptNames = Object.keys(prompts);
  for (const name of promptNames) {
    const prompt = prompts[name];
    const result = await prompt({ results })?.catch((e) => {
      throw e;
    });
    if (typeof opts?.onCancel === "function" && isCancel(result)) {
      results[name] = "canceled";
      opts.onCancel({ results });
      continue;
    }
    results[name] = result;
  }
  return results;
};
export const tasks = async (tasks2) => {
  for (const task of tasks2) {
    if (task.enabled === false) continue;
    const s2 = spinner();
    s2.start(task.title);
    const result = await task.task(s2.message);
    s2.stop(result || task.title);
  }
};
