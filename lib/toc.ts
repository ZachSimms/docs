/**
 * @file Table-of-contents extraction for cheatsheets.
 *
 * Headings are read from the MDX source at build time and given the same ids
 * that `rehype-slug` assigns during compilation (both use `github-slugger`),
 * so the entries link straight to the rendered sections.
 */

import GithubSlugger from "github-slugger";

/** One table-of-contents entry. */
export interface TocEntry {
  /** Element id of the heading, e.g. `"11-solving-equations"`. */
  readonly id: string;
  /** Heading text with Markdown markers removed. */
  readonly text: string;
  /** Heading level: 2 for `##`, 3 for `###`. */
  readonly depth: 2 | 3;
}

/** Fenced code blocks; a `#` inside one is not a heading. */
const FENCE = /```[\s\S]*?```/g;
/** `##` and `###` headings, capturing the marker and the text. */
const HEADING = /^(#{2,3})\s+(.+?)\s*#*\s*$/gm;

/**
 * Reduce a heading's Markdown to the text a browser would show, which is what
 * `rehype-slug` hashes: inline code and emphasis lose their markers, links
 * keep their label.
 */
function headingText(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~]{1,3}/g, "")
    .trim();
}

/**
 * Extract the `##` and `###` headings of a sheet as table-of-contents entries.
 *
 * Ids are generated with a fresh slugger per document, so duplicate headings
 * get `-1`, `-2` suffixes exactly as in the rendered page.
 *
 * @param body - MDX source without frontmatter.
 * @returns Entries in document order; `[]` when the sheet has no sub-headings.
 * @example
 * extractToc("## 1.1 Solving equations");
 * // [{ id: "11-solving-equations", text: "1.1 Solving equations", depth: 2 }]
 */
export function extractToc(body: string): TocEntry[] {
  const slugger = new GithubSlugger();
  return [...body.replace(FENCE, "").matchAll(HEADING)].flatMap((match) => {
    const text = headingText(match[2] ?? "");
    if (!text) return [];
    const depth = match[1]?.length === 3 ? 3 : 2;
    return [{ id: slugger.slug(text), text, depth }];
  });
}

/**
 * Which heading is "current" for a given scroll position.
 *
 * @param tops - Each heading's `getBoundingClientRect().top`, in document order.
 * @param offset - Distance from the viewport top of the reading line; a heading
 *   at or above it has been reached.
 * @param atBottom - Whether the page is scrolled to its end. The last sections
 *   of a sheet are often too short to reach the reading line, so at the bottom
 *   the last entry wins.
 * @returns The index of the current heading: the last one reached, `0` before
 *   the first is reached, and `-1` when there are no headings.
 * @example
 * pickActive([-400, 80, 700], 100, false); // 1
 */
export function pickActive(tops: readonly number[], offset: number, atBottom: boolean): number {
  if (tops.length === 0) return -1;
  if (atBottom) return tops.length - 1;
  const reached = tops.findLastIndex((top) => top <= offset);
  return Math.max(reached, 0);
}

/**
 * The `##` section a `###` entry belongs to.
 *
 * @param entries - The table of contents.
 * @param index - The entry to look up.
 * @returns The index of the nearest preceding depth-2 entry, or `-1` when
 *   `index` is itself depth 2, out of range, or has no `##` before it.
 */
export function parentOf(entries: readonly TocEntry[], index: number): number {
  if (entries[index]?.depth !== 3) return -1;
  return entries.slice(0, index).findLastIndex((entry) => entry.depth === 2);
}

/** An item's position inside a scroll container (`offsetTop`/`offsetHeight`). */
export interface Span {
  readonly top: number;
  readonly height: number;
}

/** A scroll container's viewport (`scrollTop`/`clientHeight`). */
export interface ScrollView {
  readonly scrollTop: number;
  readonly height: number;
}

/**
 * The container scroll offset that keeps `item` fully visible, moving as
 * little as possible (like `block: "nearest"`, but for one container only, so
 * the page itself never scrolls).
 *
 * @param item - The item's offset and height within the container.
 * @param view - The container's current scroll offset and visible height.
 * @param margin - Space to leave between the item and the container's edge.
 * @returns The new `scrollTop`; unchanged when the item is already in view.
 */
export function keepVisible(item: Span, view: ScrollView, margin: number): number {
  if (item.top - margin < view.scrollTop) return Math.max(item.top - margin, 0);
  const bottom = item.top + item.height + margin;
  if (bottom > view.scrollTop + view.height) return bottom - view.height;
  return view.scrollTop;
}

/** Which directions a scroll box has hidden content in. */
export interface MoreContent {
  readonly up: boolean;
  readonly down: boolean;
}

/** Pixels of overflow ignored as rounding (fractional layout sizes). */
const OVERFLOW_SLACK = 1;

/**
 * Whether a scroll box has content hidden above and/or below its viewport.
 *
 * @param view - `scrollTop`, visible `height` (`clientHeight`) and `scrollHeight`.
 * @returns `up` when scrolled away from the top, `down` when more lies below.
 * @example
 * moreContent({ scrollTop: 0, height: 300, scrollHeight: 900 }); // { up: false, down: true }
 */
export function moreContent(view: ScrollView & { readonly scrollHeight: number }): MoreContent {
  return {
    up: view.scrollTop > OVERFLOW_SLACK,
    down: view.scrollTop + view.height < view.scrollHeight - OVERFLOW_SLACK,
  };
}
