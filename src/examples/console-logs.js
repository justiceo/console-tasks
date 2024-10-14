import { replaceGlobalConsole, resetGlobalConsoleAsync, color } from "../../dist/index.js";

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
console.debug("This is a console.debug message");
// Replace global console.
replaceGlobalConsole({title: " Demo ", enableDebug: false});
console.error("This is a console.error message");
console.warn("This is a console.warn message");
console.log("This is a console.log message");
console.info("This is a console.info message");
console.debug("This is a console.debug message");
console.status("Time so far ");
console.code("let x = 0;", color.inverse(" javascript "));
console.stream("This is a console.stream message.\n");
console.log("This is a console.log message in the middle of a stream");
console.stream("Yet another console.stream message\n");
console.stream("This is a console.stream message.\n");
console.stream("This is a console.stream message.\n");
console.stream("This is a console.stream message.\n");
console.endStream();
const name = await console.prompt("What is your name?");
console.info("You answered: ", name);
const res = await console.confirm("Do you want to continue?");
console.info("You answered: ", res);
const res2 = await console.confirm("Are you sure?");
console.info("You answered: ", res2);
console.note("This is a console.note message", "Note");
console.debug("This is a console.debug message");
console.endStatus("Finished");
await resetGlobalConsoleAsync();
console.log("This is a console.log message");
console.warn("This is a console.warn message");
console.error("This is a console.error message");
console.debug("This is a console.info message");
