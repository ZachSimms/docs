/** Unit tests for `lib/topics.ts`: order, names and numbering. */
import { describe, expect, it } from "bun:test";
import { TOPICS, getTopic, topicNumber } from "@/lib/topics";

describe("TOPICS", () => {
  it("lists the fourteen topics in display order", () => {
    expect(TOPICS.map((t) => t.slug)).toEqual([
      "maths",
      "physics",
      "biology",
      "fitness",
      "ml-ai",
      "typescript",
      "databases",
      "infrastructure",
      "python",
      "cpp",
      "game-dev",
      "robotics",
      "writing",
      "design",
    ]);
  });

  it("has a human name for every topic", () => {
    expect(getTopic("ml-ai")?.name).toBe("ML/AI");
    expect(getTopic("cpp")?.name).toBe("C++");
    expect(getTopic("typescript")?.name).toBe("TypeScript");
    expect(getTopic("databases")?.name).toBe("Databases");
    expect(getTopic("infrastructure")?.name).toBe("Infrastructure");
    expect(getTopic("fitness")?.name).toBe("Fitness");
    expect(getTopic("game-dev")?.name).toBe("Game dev");
  });
});

describe("getTopic", () => {
  it("returns undefined for an unknown slug", () => {
    expect(getTopic("nope")).toBeUndefined();
  });
});

describe("topicNumber", () => {
  it("numbers the first topic highest and the last topic 1", () => {
    expect(topicNumber("maths")).toBe(14);
    expect(topicNumber("physics")).toBe(13);
    expect(topicNumber("fitness")).toBe(11);
    expect(topicNumber("typescript")).toBe(9);
    expect(topicNumber("infrastructure")).toBe(7);
    expect(topicNumber("game-dev")).toBe(4);
    expect(topicNumber("design")).toBe(1);
  });

  it("returns undefined for an unknown slug", () => {
    expect(topicNumber("nope")).toBeUndefined();
  });
});
