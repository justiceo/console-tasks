import { text, spinner } from "./index.js";

const s = spinner();
s.start("Installing via npm");
// Do installation here
const meaning = await text({
  message: "What is the meaning of life?",
  placeholder: "Not sure",
  initialValue: "42",
  validate(value) {
    if (value.length === 0) return `Value is required!`;
  },
});
s.stop("Installed via npm");
