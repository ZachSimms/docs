/**
 * @file Finding tags in a page's HTML in linear time.
 *
 * A pattern like `/<link\b[^>]*>/gi` is quadratic on HTML the reader writes: every
 * `<link` with no `>` after it scans to the end of the text before failing, and the
 * engine then tries again from the next one. These helpers match exactly what those
 * patterns match, but stop at the first tag that can't close: no later one can either.
 */

/** A tag found by {@link firstTag} or passed to a {@link replaceTags} callback. */
export interface Tag {
  /** Where the tag starts. */
  readonly index: number;
  /** The whole match: the tag, and for an element with a body, up to its closing tag. */
  readonly text: string;
  /** What is between the tag's name and its `>` (the attributes). */
  readonly attrs: string;
  /** For an element with a body, what is between its tags; otherwise `""`. */
  readonly body: string;
}

/** A global copy of `pattern`, whose `lastIndex` this module may move. */
const scanner = (pattern: RegExp) =>
  new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`);

/** The tag whose start `open` finds at or after `from`, or `null` if none closes. */
function tagAt(html: string, open: RegExp, close: RegExp | null, from: number): Tag | null {
  open.lastIndex = from;
  const start = open.exec(html);
  if (start === null) return null;
  const nameEnd = start.index + start[0].length;
  const tagEnd = html.indexOf(">", nameEnd);
  if (tagEnd === -1) return null;
  let end = tagEnd + 1;
  let body = "";
  if (close !== null) {
    close.lastIndex = end;
    const closing = close.exec(html);
    if (closing === null) return null;
    body = html.slice(end, closing.index);
    end = closing.index + closing[0].length;
  }
  return {
    index: start.index,
    text: html.slice(start.index, end),
    attrs: html.slice(nameEnd, tagEnd),
    body,
  };
}

/**
 * The first tag that `open` starts, as `new RegExp(open.source + "([^>]*)>")` would find it.
 *
 * @param html - The page.
 * @param open - The start of the tag, e.g. `/<head\b/i`.
 */
export function firstTag(html: string, open: RegExp): Tag | null {
  return tagAt(html, scanner(open), null, 0);
}

/**
 * Replace every tag that `open` starts, as `html.replace(/<open>([^>]*)>/g, …)` would, or
 * with `close`, every element as `/<open>([^>]*)>([\s\S]*?)<close>/g` would.
 *
 * @param html - The page.
 * @param open - The start of the tag, e.g. `/<(?:img|source)\b/i`.
 * @param replace - The replacement for a tag.
 * @param close - The closing tag, for an element whose body is part of the match.
 */
export function replaceTags(
  html: string,
  open: RegExp,
  replace: (tag: Tag) => string,
  close?: RegExp,
): string {
  const opener = scanner(open);
  const closer = close === undefined ? null : scanner(close);
  let out = "";
  let from = 0;
  for (let tag = tagAt(html, opener, closer, 0); tag; tag = tagAt(html, opener, closer, from)) {
    out += html.slice(from, tag.index) + replace(tag);
    from = tag.index + tag.text.length;
  }
  return out + html.slice(from);
}
