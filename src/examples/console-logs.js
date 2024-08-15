import { replaceGlobalConsole, resetGlobalConsoleAsync } from "../../dist/widgets/index.js";

console.log("This is a console.log message");
console.warn("This is a console.warn message");
console.error("This is a console.error message");
console.debug("This is a console.info message");
// Replace global console.
replaceGlobalConsole();
console.log("This is a console.log message");
console.warn("This is a console.warn message");
console.error("This is a console.error message");
console.debug("This is a console.info message");
await resetGlobalConsoleAsync();
console.log("This is a console.log message");
console.warn("This is a console.warn message");
console.error("This is a console.error message");
console.debug("This is a console.info message");
