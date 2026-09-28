import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Draws judgments from a synthesis: key conclusions, confidence levels, competing explanations and indicators to watch.",
  model: "openai/gpt-oss-120b",
});
