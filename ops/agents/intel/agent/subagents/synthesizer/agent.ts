import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Merges collected material into one attributed account: deduplicates, dates claims and marks contradictions.",
  model: "openai/gpt-oss-120b",
});
