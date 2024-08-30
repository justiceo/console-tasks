import { taskify } from "..";

await taskify(
  () => new Promise((resolve) => setTimeout(resolve, 2000)),
  "2 seconds timer"
);
