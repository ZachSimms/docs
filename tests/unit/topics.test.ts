/** Unit tests for `lib/topics.ts`: order, names and numbering. */
import { describe, expect, it } from "bun:test";
import { TOPICS, getTopic, topicNumber } from "@/lib/topics";

describe("TOPICS", () => {
  it("lists the twenty-two topics in alphabetical order", () => {
    expect(TOPICS.map((t) => t.slug)).toEqual([
      "3d",
      "aviation",
      "biology",
      "cpp",
      "databases",
      "design",
      "dsa",
      "economics",
      "finance",
      "fitness",
      "game-dev",
      "infrastructure",
      "leadership",
      "math",
      "ml-ai",
      "physics",
      "python",
      "robotics",
      "startups",
      "thinking",
      "typescript",
      "writing",
    ]);
  });

  it("keeps the names sorted, ignoring case, so new topics can't break the order", () => {
    const names = TOPICS.map((t) => t.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }));
    expect(names).toEqual(sorted);
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
    expect(getTopic("aviation")?.name).toBe("Aviation");
  });
});

describe("getTopic", () => {
  it("returns undefined for an unknown slug", () => {
    expect(getTopic("nope")).toBeUndefined();
  });
});

describe("topicNumber", () => {
  it("numbers the first topic highest and the last topic 1", () => {
    expect(topicNumber("3d")).toBe(22);
    expect(topicNumber("aviation")).toBe(21);
    expect(topicNumber("design")).toBe(17);
    expect(topicNumber("dsa")).toBe(16);
    expect(topicNumber("game-dev")).toBe(12);
    expect(topicNumber("math")).toBe(9);
    expect(topicNumber("ml-ai")).toBe(8);
    expect(topicNumber("thinking")).toBe(3);
    expect(topicNumber("typescript")).toBe(2);
    expect(topicNumber("writing")).toBe(1);
  });

  it("returns undefined for an unknown slug", () => {
    expect(topicNumber("nope")).toBeUndefined();
  });
});
