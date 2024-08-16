import fs from "fs";
import util from "util";

// Create a writable stream for demonstration purposes
const outputStream = fs.createWriteStream('./console_output.txt');

// Create a custom console that writes to our stream
const customConsole = new console.Console(outputStream);

// Function to add a separator in the output
function addSeparator(title) {
  customConsole.log('\n' + '='.repeat(50));
  customConsole.log(title);
  customConsole.log('='.repeat(50) + '\n');
}

// 1. console.assert()
addSeparator('console.assert()');
customConsole.assert(true, 'This assertion will not show');
customConsole.assert(false, 'This assertion will show');

// 2. console.count() and console.countReset()
addSeparator('console.count() and console.countReset()');
customConsole.count('counter');
customConsole.count('counter');
customConsole.count('counter');
customConsole.countReset('counter');
customConsole.count('counter');

// 3. console.debug()
addSeparator('console.debug()');
customConsole.debug('This is a debug message');

// 4. console.dir()
addSeparator('console.dir()');
customConsole.dir({ name: 'John', age: 30 }, { depth: null, colors: true });

// 5. console.dirxml()
addSeparator('console.dirxml()');
customConsole.dirxml('<html><body><h1>Hello, World!</h1></body></html>');

// 6. console.group() and console.groupEnd()
addSeparator('console.group() and console.groupEnd()');
customConsole.group('Group 1');
customConsole.log('Inside Group 1');
customConsole.group('Nested Group');
customConsole.log('Inside Nested Group');
customConsole.groupEnd();
customConsole.groupEnd();

// 7. console.table()
addSeparator('console.table()');
const people = [
  { name: 'John', age: 30 },
  { name: 'Jane', age: 25 }
];
customConsole.table(people);

// 8. console.time() and console.timeEnd()
addSeparator('console.time() and console.timeEnd()');
customConsole.time('Timer');
setTimeout(() => {
  customConsole.timeEnd('Timer');
}, 1000);

// 9. console.timeLog()
addSeparator('console.timeLog()');
customConsole.time('LoggedTimer');
setTimeout(() => {
  customConsole.timeLog('LoggedTimer');
}, 500);
setTimeout(() => {
  customConsole.timeEnd('LoggedTimer');
}, 1000);

// 10. console.trace()
addSeparator('console.trace()');
function traceDemo() {
  customConsole.trace('Trace demonstration');
}
traceDemo();

// 11. console.Console (custom Console creation)
addSeparator('Custom Console Creation');
const customOutput = fs.createWriteStream('./stdout.log');
const customErrorOutput = fs.createWriteStream('./stderr.log');
const customLogger = new console.Console({ stdout: customOutput, stderr: customErrorOutput });
customLogger.log('This goes to stdout');
customLogger.error('This goes to stderr');

// Note: console.clear() is not demonstrated as it clears the console, which isn't suitable for our file output.

// Finish up
setTimeout(() => {
  customConsole.log('\nDemonstration complete. Check console_output.txt for results.');
  outputStream.end();
}, 2000);