/**
 * @file The home page's activity grid: one cell per day for the last weeks, counting
 * this repository's commits, the sheets dated that day and the posts published.
 *
 * Server/build-time only. {@link buildActivity} is pure (dates in, grid out) so it is
 * tested directly; {@link gitCommitDates} reads `git log` at build time and returns
 * `null` where history is unavailable or shallow (some CI clones), in which case the
 * grid counts sheets and posts only rather than showing a wrong commit total.
 */

import { execFileSync } from "node:child_process";

/** How many weeks the grid spans (columns). */
export const ACTIVITY_WEEKS = 44;

/** Minimum distance, in columns, between two month labels. */
const MONTH_GAP = 6;

/** Minimum distance before the current month's label, which sits flush right. */
const END_GAP = 4;

/** Short month names, indexed by `getUTCMonth()`. */
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Intensity of a day: nothing, a little, more, the most. */
export type ActivityLevel = 0 | 1 | 2 | 3;

/** One day of the grid. */
export interface ActivityDay {
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly commits: number;
  readonly sheets: number;
  readonly posts: number;
  readonly level: ActivityLevel;
}

/** The grid and its totals. */
export interface Activity {
  readonly weeks: number;
  /** Columns, oldest first; each holds Sunday to Saturday, cut off after today. */
  readonly columns: readonly (readonly ActivityDay[])[];
  /** Month labels and the column each starts at. */
  readonly months: readonly { readonly label: string; readonly column: number }[];
  /** Totals over the grid; `commits` is `null` when git history was unavailable. */
  readonly totals: {
    readonly commits: number | null;
    readonly sheets: number;
    readonly posts: number;
  };
}

/** Inputs of {@link buildActivity}: every date is `YYYY-MM-DD`. */
export interface ActivityInput {
  readonly today: string;
  readonly weeks?: number;
  /** One entry per commit, or `null` when unknown. */
  readonly commits: readonly string[] | null;
  /** One entry per sheet (its frontmatter date). */
  readonly sheets: readonly string[];
  /** One entry per post. */
  readonly posts: readonly string[];
}

/** Parse `YYYY-MM-DD` as a UTC midnight. */
function utc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** Format a UTC date as `YYYY-MM-DD`. */
function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** `date` shifted by `days`. */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Count occurrences of each date. */
function tally(dates: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const date of dates) counts.set(date, (counts.get(date) ?? 0) + 1);
  return counts;
}

/**
 * A day's level from its total and the busiest day's: thirds of the maximum.
 *
 * @returns 0 for no activity; otherwise 1–3.
 */
export function levelFor(total: number, max: number): ActivityLevel {
  if (total <= 0 || max <= 0) return 0;
  const ratio = total / max;
  return ratio <= 1 / 3 ? 1 : ratio <= 2 / 3 ? 2 : 3;
}

/**
 * Build the grid: `weeks` columns ending with the week that holds `today`, each from
 * Sunday to Saturday (days after today are left out), with month labels at least
 * {@link MONTH_GAP} columns apart, plus the current month's in the last column.
 */
export function buildActivity({
  today,
  weeks = ACTIVITY_WEEKS,
  commits,
  sheets,
  posts,
}: ActivityInput): Activity {
  const end = utc(today);
  const start = addDays(end, -end.getUTCDay() - (weeks - 1) * 7);
  const first = iso(start);
  const inRange = (date: string) => date >= first && date <= today;

  const commitCounts = tally((commits ?? []).filter(inRange));
  const sheetCounts = tally(sheets.filter(inRange));
  const postCounts = tally(posts.filter(inRange));
  const totalOf = (date: string) =>
    (commitCounts.get(date) ?? 0) + (sheetCounts.get(date) ?? 0) + (postCounts.get(date) ?? 0);

  const days: string[] = [];
  for (let day = start; iso(day) <= today; day = addDays(day, 1)) days.push(iso(day));
  const max = Math.max(0, ...days.map(totalOf));

  const columns: ActivityDay[][] = [];
  days.forEach((date, i) => {
    const column = Math.floor(i / 7);
    (columns[column] ??= []).push({
      date,
      commits: commitCounts.get(date) ?? 0,
      sheets: sheetCounts.get(date) ?? 0,
      posts: postCounts.get(date) ?? 0,
      level: levelFor(totalOf(date), max),
    });
  });

  const months: { label: string; column: number }[] = [];
  let previousMonth = -1;
  columns.forEach((column, i) => {
    const month = utc(column[0]!.date).getUTCMonth();
    const last = months.at(-1);
    if (month !== previousMonth && (!last || i - last.column >= MONTH_GAP)) {
      months.push({ label: MONTHS[month]!, column: i });
    }
    previousMonth = month;
  });
  // The current month always gets a label at the right edge, as long as it clears the last one.
  const lastColumn = columns.length - 1;
  const current = MONTHS[utc(today).getUTCMonth()]!;
  const lastLabel = months.at(-1);
  if (lastLabel && lastLabel.label !== current && lastColumn - lastLabel.column >= END_GAP) {
    months.push({ label: current, column: lastColumn });
  }

  const sum = (counts: Map<string, number>) => [...counts.values()].reduce((a, b) => a + b, 0);
  return {
    weeks,
    columns,
    months,
    totals: {
      commits: commits === null ? null : sum(commitCounts),
      sheets: sum(sheetCounts),
      posts: sum(postCounts),
    },
  };
}

/**
 * Every commit's date (`YYYY-MM-DD`) in this repository, from `git log`.
 *
 * @returns `null` if git is missing, this is not a repository, or the clone is shallow.
 */
export function gitCommitDates(cwd: string = process.cwd()): string[] | null {
  try {
    const run = (args: string[]) =>
      execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    if (run(["rev-parse", "--is-shallow-repository"]).trim() !== "false") return null;
    return run(["log", "--format=%ad", "--date=short"]).split("\n").filter(Boolean);
  } catch {
    return null;
  }
}
