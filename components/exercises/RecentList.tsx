/**
 * @file The "Recent" list shared by the exercise panel and the math sheet: open an item, remove
 * one (×), or clear them all after a confirmation.
 *
 * Client component; stateless apart from the inline "clear all?" confirmation.
 */

"use client";

import { useState, type ReactNode } from "react";

/** One row of the list. */
export interface RecentItem {
  readonly id: string;
  readonly title: string;
  /** Shown after the title, dimmed: language, difficulty. */
  readonly detail: string;
  /** Progress: "✓ passed", "3/5 tests". */
  readonly status?: ReactNode;
}

/** Props for {@link RecentList}. */
interface RecentListProps {
  readonly items: readonly RecentItem[];
  readonly currentId: string | null;
  /** Something is running: selecting and removing wait. */
  readonly disabled: boolean;
  /** `h2` on a sheet, `h3` inside the playground's panel. */
  readonly heading: "h2" | "h3";
  /** What the items are, for labels: "exercise", "problem". */
  readonly noun: string;
  onSelect(id: string): void;
  onRemove(ids: readonly string[] | "all"): void;
}

/** The recent items, newest first. */
export function RecentList({
  items,
  currentId,
  disabled,
  heading: Heading,
  noun,
  onSelect,
  onRemove,
}: RecentListProps) {
  const [confirming, setConfirming] = useState(false);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="ex-recent" className="ex-recent-section">
      <div className="ex-recent-head">
        <Heading id="ex-recent">Recent</Heading>
        {confirming ? (
          <span className="ex-label" role="group" aria-label={`Clear all ${noun}s`}>
            remove all {items.length} {items.length === 1 ? noun : `${noun}s`} and your work on
            them?{" "}
            <button
              type="button"
              className="link"
              onClick={() => {
                setConfirming(false);
                onRemove("all");
              }}
            >
              <i>yes</i>
            </button>{" "}
            <button type="button" className="link" onClick={() => setConfirming(false)}>
              <i>no</i>
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="link ex-label"
            disabled={disabled}
            onClick={() => setConfirming(true)}
          >
            <i>clear all</i>
          </button>
        )}
      </div>
      <ol className="ex-recent">
        {items.map((item, i) => (
          <li key={item.id}>
            <span className="ex-label">{String(i).padStart(2, "0")}. </span>
            <button
              type="button"
              className="link"
              aria-current={item.id === currentId ? "true" : undefined}
              disabled={disabled}
              onClick={() => onSelect(item.id)}
            >
              <i>{item.title}</i>
            </button>{" "}
            <span className="ex-label">{item.detail}</span> {item.status}{" "}
            <button
              type="button"
              className="link ex-remove"
              disabled={disabled}
              aria-label={`Remove ${item.title}`}
              title={`Remove this ${noun} and your work on it`}
              onClick={() => onRemove([item.id])}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
