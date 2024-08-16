import { replaceGlobalConsole, resetGlobalConsoleAsync } from "../../dist/widgets/index.js";

async function sleep(seconds, signal) {
    if (signal?.aborted) return Promise.resolve();
  
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, seconds * 1000);
      if (signal) {
        signal.addEventListener("abort", () => {
          clearTimeout(timeout);
          resolve();
        });
      }
    });
  }

console.log("This is a console.log message");
console.warn("This is a console.warn message");
console.error("This is a console.error message");
console.debug("This is a console.info message");
// Replace global console.
replaceGlobalConsole({keepAlive: true});
console.log("This is a console.log message");
console.warn("This is a console.warn message");

await sleep(1);
console.error("This is a console.error message");
console.debug("This is a console.info message");
console.code("let x = 0;", "javascript");
console.stream("This is a console.stream message. ");
console.log("This is a console.log message in the middle of a stream");
console.stream("Yet another console.stream message");
console.endStream();
const res = await console.confirm("Do you want to continue?");
console.debug("result: ", res);
const res2 = await console.confirm("Are you sure?");
console.debug("result2: ", res2);
console.note("This is a console.note message", "Note");
console.debug("This is a console.debug message");
await resetGlobalConsoleAsync();
console.log("This is a console.log message");
console.warn("This is a console.warn message");
console.error("This is a console.error message");
console.debug("This is a console.info message");
