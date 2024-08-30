import { TaskManager } from "../task-api";
import { ConfirmationPrompt } from "../widgets/confirmation-prompt";
import { TextPrompt } from "../widgets/text-prompt";
import { Logger } from "../widgets/logger";
import { EmailPrompt } from "../widgets/email-prompt";

const logger = new Logger({ tag: "Demo", enableDebug: true });

const command = new ConfirmationPrompt("Install nodejs?");
const textPrompt = new TextPrompt("What is your name?", "start typing");
const emailPrompt = new EmailPrompt("What is your email?", "hello@example.com");

// Create a TaskManager instance
const taskManager = TaskManager.getInstance({ title: " Prompt Demo " });

// Add and execute the task(s)
const [cid] = taskManager.run(emailPrompt);
taskManager.onStatusChange(cid, (status, data) => {
  logger.log(`Status: ${status}, Data: ${data}`);
});
