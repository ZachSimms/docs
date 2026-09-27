/** Unit tests for the home page's activity grid data (`lib/activity.ts`). */
import os from "node:os";
import { describe, expect, it } from "bun:test";
import { ACTIVITY_WEEKS, buildActivity, gitCommitDates, levelFor } from "@/lib/activity";

/** A Saturday, so the last column is a full week. */
const SATURDAY = "2026-09-26";

describe("buildActivity", () => {
  it("spans the given weeks, Sunday to Saturday, ending with the week of today", () => {
    const activity = buildActivity({ today: SATURDAY, commits: [], sheets: [], posts: [] });
    expect(activity.weeks).toBe(ACTIVITY_WEEKS);
    expect(activity.columns).toHaveLength(ACTIVITY_WEEKS);
    expect(activity.columns.every((column) => column.length === 7)).toBe(true);
    expect(new Date(`${activity.columns[0]![0]!.date}T00:00:00Z`).getUTCDay()).toBe(0);
    expect(activity.columns.at(-1)!.at(-1)!.date).toBe(SATURDAY);
  });

  it("cuts the last column off after today", () => {
    const activity = buildActivity({ today: "2026-09-23", commits: [], sheets: [], posts: [] });
    const last = activity.columns.at(-1)!;
    expect(last.map((day) => day.date)).toEqual([
      "2026-09-20",
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
    ]);
  });

  it("counts commits, sheets and posts per day and in total, ignoring dates outside the grid", () => {
    const activity = buildActivity({
      today: SATURDAY,
      weeks: 2,
      commits: ["2026-09-25", "2026-09-25", "2025-01-01"],
      sheets: ["2026-09-25", "2026-09-14"],
      posts: ["2026-09-26", "2027-01-01"],
    });
    const day = activity.columns.flat().find((d) => d.date === "2026-09-25")!;
    expect(day).toMatchObject({ commits: 2, sheets: 1, posts: 0, level: 3 });
    expect(activity.totals).toEqual({ commits: 2, sheets: 2, posts: 1 });
    // Thirds of the busiest day (3): 1 is level 1.
    expect(activity.columns.flat().find((d) => d.date === "2026-09-26")?.level).toBe(1);
    expect(activity.columns.flat().find((d) => d.date === "2026-09-20")?.level).toBe(0);
  });

  it("reports commits as unknown when git history is unavailable", () => {
    const activity = buildActivity({
      today: SATURDAY,
      commits: null,
      sheets: [SATURDAY],
      posts: [],
    });
    expect(activity.totals).toEqual({ commits: null, sheets: 1, posts: 0 });
  });

  it("labels months at least six columns apart, and always the current month near the end", () => {
    for (const today of [SATURDAY, "2026-09-27", "2026-03-10"]) {
      const { months, columns } = buildActivity({ today, commits: [], sheets: [], posts: [] });
      for (let i = 1; i < months.length - 1; i++) {
        expect(months[i]!.column - months[i - 1]!.column).toBeGreaterThanOrEqual(6);
      }
      expect(months[0]?.column).toBe(0);
      const month = new Date(`${today}T00:00:00Z`).toLocaleString("en-US", {
        month: "short",
        timeZone: "UTC",
      });
      expect(months.at(-1)?.label).toBe(month);
      expect(months.at(-1)!.column).toBeGreaterThanOrEqual(columns.length - 5);
    }
  });
});

describe("levelFor", () => {
  it("splits activity into thirds of the busiest day", () => {
    expect(levelFor(0, 9)).toBe(0);
    expect(levelFor(3, 9)).toBe(1);
    expect(levelFor(6, 9)).toBe(2);
    expect(levelFor(7, 9)).toBe(3);
    expect(levelFor(1, 0)).toBe(0);
  });
});

describe("gitCommitDates", () => {
  it("returns null outside a repository", () => {
    expect(gitCommitDates(os.tmpdir())).toBeNull();
  });

  it("returns YYYY-MM-DD dates here, or null in a shallow clone", () => {
    const dates = gitCommitDates();
    if (dates === null) return;
    expect(dates.length).toBeGreaterThan(0);
    expect(dates.every((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))).toBe(true);
  });
});
