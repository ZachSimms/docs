import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Finds and reads primary sources for one well-defined collection task; returns excerpts with URLs and dates.",
  model: "openai/gpt-oss-120b",
});
