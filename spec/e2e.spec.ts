import { TaskManager, addMessage, Task, BaseTask } from "../src";
import { jest } from "@jest/globals";
import { Writable } from "stream";

class FakeWritableStream extends Writable {
  private contents: string[];

  constructor(options?: any) {
    super(options);
    this.contents = [];
  }

  _write(
    chunk: any,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void
  ): void {
    console.log("chunk: ", chunk.toString(), "encoding: ", encoding, "callback: ", callback);
    if (Buffer.isBuffer(chunk)) {
      this.contents.push(chunk.toString());
    } else if (typeof chunk === "string") {
      this.contents.push(chunk);
    } else {
      this.contents.push(chunk.toString());
    }
    callback();
  }

  getContents(): string[] {
    return this.contents;
  }

  getContentsAsString(): string {
    return this.contents.join("");
  }

  clearContents(): void {
    this.contents = [];
  }
}

// Adapted from https://github.com/chalk/ansi-regex
// @see LICENSE
function ansiRegex() {
	const pattern = [
		'[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
		'(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
	].join('|');

	return new RegExp(pattern, 'g');
}
const strip = (str: string) => str.replace(ansiRegex(), '');

describe("Task", () => {
  let mockUpdateFn: jest.Mock;
  let mockSignal: AbortSignal;
  let taskManager: TaskManager;
  let stream: FakeWritableStream;

  beforeEach(() => {
    mockUpdateFn = jest.fn();
    mockSignal = new AbortController().signal;
    stream = new FakeWritableStream();
    taskManager = TaskManager.getInstance({stream: stream});
  });

  it("should display the initial message correctly", async () => {
    const initialMessage = "Starting task...";
    taskManager.add({
      initialMessage,
      task: (updateFn, signal) => {
        updateFn(initialMessage);
        updateFn("Task completed successfully");
        return Promise.resolve();
      },
    });
    await taskManager.run();

    console.log("Stream contents");
    console.log("another: ", strip(stream.getContentsAsString()), strip(stream.getContentsAsString()).length);
    expect("Starting task...").toContain(initialMessage);
  });
});
