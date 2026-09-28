/** @file The intel agent: collection, synthesis and analysis on open sources. */
import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Research desk: collects open-source information on a question, synthesizes it and analyzes it, with sources and confidence.",
  model: "openai/gpt-oss-120b",
});
