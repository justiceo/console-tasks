import { TaskManager } from "../../dist/index.js";
import { StreamTask } from "../../dist/index.js";

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
    for(const word of words) {
        await sleep(0.1);
        streamTask.stream(word + " ");
    }
    streamTask.close();
}

const streamTask = new StreamTask();
TaskManager.getInstance().run(streamTask);

let chunks = "";
streamTask.addHook("<code>", "</code>", (event, data) => {

    switch (event) {
      case "chunk":
        return data;
        break;
      case "end":
        return "<replaced>"
        break;
    }
  });

streamText(`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Some text <code>const x = 5;
    with multiple lines
    and also text
    </code>  more text.
    Lorem ipsum dolor sit amet, consectetur adipiscing elit, Lorem ipsum dolor sit amet, consectetur adipiscing elit
    `);

