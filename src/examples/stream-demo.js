import { TaskManager } from "../../dist/index.js";
import { StreamTask } from "../../dist/index.js";
import { FileHandler } from "./file-handler.js";

function sleep(seconds, signal) {
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

async function streamText(text) {
  const words = text.split(" ");
  for (const word of words) {
    await sleep(0.1);
    streamTask.stream(word + " ");
  }
  streamTask.close();
}

const streamTask = new StreamTask();
TaskManager.getInstance().run(streamTask);

let chunks = "";
streamTask.addHook({
  startSequence: "<code>",
  endSequence: "</code>",
  callback: (event, data) => {
    switch (event) {
      case "chunk":
        return data;
        break;
      case "end":
        return "<replaced>";
        break;
    }
  },
});

streamTask.addHook(FileHandler);

streamText(`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quicksort code:

    Now some file updates:
\`\`\`js
// example/test2.txt:W

    Line 1\nLine 2\nLine 3\nLine 4\nLine 5\nLine 6\nLine 7\nLine 8\nLine 9\nLine 10

\`\`\`

    Now some code updates
    <code>
    function quicksort(array) {
        if (array.length <= 1) {
            return array;
        }
        var unsorted = [23, 45, 16, 37, 3, 99, 22];
        var sorted = quicksort(unsorted);

        console.log('Sorted array', sorted);
    }
    </code>  more text.
    
    closing text.
    `);
