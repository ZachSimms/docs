/** Unit tests for `lib/topics.ts`: order, names and numbering. */
import { describe, expect, it } from "bun:test";
import { TOPICS, getTopic, topicNumber } from "@/lib/topics";

describe("TOPICS", () => {
  it("lists the twenty-one topics in display order", () => {
    expect(TOPICS.map((t) => t.slug)).toEqual([
      "math",
      "physics",
      "biology",
      "fitness",
      "economics",
      "finance",
      "thinking",
      "leadership",
      "startups",
      "ml-ai",
      "dsa",
      "typescript",
      "databases",
      "infrastructure",
      "python",
      "cpp",
      "3d",
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
    expect(getTopic("economics")?.name).toBe("Economics");
    expect(getTopic("game-dev")?.name).toBe("Game dev");
    expect(getTopic("finance")?.name).toBe("Finance");
    expect(getTopic("thinking")?.name).toBe("Thinking");
    expect(getTopic("leadership")?.name).toBe("Leadership");
    expect(getTopic("startups")?.name).toBe("Startups");
    expect(getTopic("dsa")?.name).toBe("DS&A");
    expect(getTopic("3d")?.name).toBe("3D graphics");
  });
});

describe("getTopic", () => {
  it("returns undefined for an unknown slug", () => {
    expect(getTopic("nope")).toBeUndefined();
  });
});

describe("topicNumber", () => {
  it("numbers the first topic highest and the last topic 1", () => {
    expect(topicNumber("math")).toBe(21);
    expect(topicNumber("physics")).toBe(20);
    expect(topicNumber("fitness")).toBe(18);
    expect(topicNumber("economics")).toBe(17);
    expect(topicNumber("finance")).toBe(16);
    expect(topicNumber("startups")).toBe(13);
    expect(topicNumber("dsa")).toBe(11);
    expect(topicNumber("typescript")).toBe(10);
    expect(topicNumber("infrastructure")).toBe(8);
    expect(topicNumber("3d")).toBe(5);
    expect(topicNumber("game-dev")).toBe(4);
    expect(topicNumber("writing")).toBe(2);
    expect(topicNumber("design")).toBe(1);
  });

  it("returns undefined for an unknown slug", () => {
    expect(topicNumber("nope")).toBeUndefined();
  });
});
