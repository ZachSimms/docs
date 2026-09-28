/** @file The life agent: private, answers to its owner only. */
import { defineAgent } from "eve";

export default defineAgent({
  description: "Personal assistant: plans, reminders, and questions about the owner's own affairs.",
  model: "openai/gpt-oss-120b",
});
