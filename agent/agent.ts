/**
 * @file The eve agent's runtime config. Spike: the same default model as the exercise routes
 * (see `lib/exercises/ai.ts`), resolved through the AI Gateway.
 */
import { defineAgent } from "eve";

export default defineAgent({
  model: "openai/gpt-oss-120b",
});
