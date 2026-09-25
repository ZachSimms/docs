/** Unit tests for `lib/topics.ts`: order, names and numbering. */
import { describe, expect, it } from "bun:test";
import { TOPICS, getTopic, topicNumber } from "@/lib/topics";

describe("TOPICS", () => {
  it("lists the twelve topics in display order", () => {
    expect(TOPICS.map((t) => t.slug)).toEqual([
      "maths",
      "physics",
      "biology",
      "ml-ai",
      "typescript",
      "databases",
      "infrastructure",
      "python",
      "cpp",
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
  });
});

describe("getTopic", () => {
  it("returns undefined for an unknown slug", () => {
    expect(getTopic("nope")).toBeUndefined();
  });
});

describe("topicNumber", () => {
  it("numbers the first topic highest and the last topic 1", () => {
    expect(topicNumber("maths")).toBe(12);
    expect(topicNumber("physics")).toBe(11);
    expect(topicNumber("typescript")).toBe(8);
    expect(topicNumber("infrastructure")).toBe(6);
    expect(topicNumber("design")).toBe(1);
  });

  it("returns undefined for an unknown slug", () => {
    expect(topicNumber("nope")).toBeUndefined();
  });
});
