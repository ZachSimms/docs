/**
 * @file The home page's activity grid (see `lib/activity.ts`): a summary line with a
 * legend, one mark per day (columns are weeks, Sunday at the top), month labels below.
 *
 * Server component. Marks are drawn by CSS by level (a dot, then a hollow, a filled and
 * a larger filled square), so they don't depend on the reader's monospace font. Each
 * day's counts are in its `title`; the whole grid is one image for screen readers,
 * described by the summary line.
 */

import type { CSSProperties } from "react";
import type { Activity, ActivityDay } from "@/lib/activity";

/** Counts to describe; `commits` is `null` when unknown (then left out). */
type Counts = { commits: number | null; sheets: number; posts: number };

/** `3 commits, 1 sheet, 0 posts`; with `skipZero`, only the counts above zero. */
function describe(counts: Counts, skipZero = false): string {
  const parts: [number, string][] = [
    ...(counts.commits === null ? [] : [[counts.commits, "commit"] as [number, string]]),
    [counts.sheets, "sheet"],
    [counts.posts, "post"],
  ];
  return parts
    .filter(([n]) => !skipZero || n > 0)
    .map(([n, noun]) => `${n} ${noun}${n === 1 ? "" : "s"}`)
    .join(", ");
}

/** A day's tooltip: its date and whatever happened. */
function dayTitle(day: ActivityDay): string {
  const total = day.commits + day.sheets + day.posts;
  return total === 0 ? `${day.date}: nothing` : `${day.date}: ${describe(day, true)}`;
}

/** Columns a label needs; one starting closer than this to the end is right-aligned instead. */
const LABEL_COLUMNS = 3;

/** Place a month label at its column, or flush with the right edge near the end. */
function monthStyle(column: number, weeks: number): CSSProperties {
  return column > weeks - LABEL_COLUMNS
    ? { gridColumn: `${weeks - LABEL_COLUMNS + 1} / -1`, justifySelf: "end" }
    : { gridColumnStart: column + 1 };
}

/** Render the summary, the grid and the month labels. */
export function ActivityGrid({ activity }: { activity: Activity }) {
  const summary = `Last ${activity.weeks} weeks: ${describe(activity.totals)}`;
  const style = { "--weeks": activity.weeks } as CSSProperties;

  return (
    <section className="activity" style={style}>
      <p className="activity-head">
        <span id="activity-summary">{summary}</span>
        <span className="activity-legend" aria-hidden="true">
          {[0, 1, 2, 3].map((level) => (
            <span key={level} className="activity-cell" data-level={level} />
          ))}
        </span>
      </p>
      <div className="activity-grid" role="img" aria-labelledby="activity-summary">
        {activity.columns.flatMap((column) =>
          column.map((day) => (
            <span
              key={day.date}
              className="activity-cell"
              data-level={day.level}
              title={dayTitle(day)}
            />
          )),
        )}
      </div>
      <div className="activity-months" aria-hidden="true">
        {activity.months.map((month) => (
          <span
            key={`${month.column}-${month.label}`}
            style={monthStyle(month.column, activity.weeks)}
          >
            {month.label}
          </span>
        ))}
      </div>
    </section>
  );
}
