/**
 * @file Build-time search index construction.
 *
 * Server only (reads content from disk). The route handler at `/search-index.json`
 * serialises {@link buildSearchIndex} once at build time; the client palette
 * fetches that JSON and ranks it with `lib/search-rank.ts`.
 *
 * The Markdown stripping here is intentionally approximate: the goal is a
 * compact bag of words per sheet, not a faithful render.
 */

import { CONTENT_ROOT, listAllSheets, readSheetBody, sheetHref } from "./content";
import type { SearchDoc } from "./search-rank";
import { TOPIC_SLUGS } from "./topics";

export type { SearchDoc } from "./search-rank";

/** Fenced code blocks, including their content. Removed before indexing. */
const FENCE = /```[\s\S]*?```/g;
/** ATX headings (`# …` to `###### …`), capturing the text without markers. */
const HEADING = /^#{1,6}\s+(.+?)\s*#*\s*$/gm;
/** Keeps the static index small; searches rarely need more than the opening of a sheet. */
export const MAX_TEXT_LENGTH = 4000;

/** Drop fenced code blocks so their contents are neither indexed nor mistaken for headings. */
function withoutFences(body: string): string {
  return body.replace(FENCE, " ");
}

/**
 * Collect heading texts from a Markdown body.
 *
 * @param body - Markdown without frontmatter.
 * @returns Heading texts in document order, trimmed, `#` markers removed;
 *   headings inside code fences are ignored.
 */
export function extractHeadings(body: string): string[] {
  return [...withoutFences(body).matchAll(HEADING)].map((m) => m[1]?.trim() ?? "").filter(Boolean);
}

/**
 * Reduce Markdown to searchable plain text.
 *
 * Removes code fences, heading lines (indexed separately), HTML tags, table
 * pipes and rules, list markers and emphasis markers; reduces images, links
 * and inline code to their visible text; collapses whitespace.
 *
 * @param body - Markdown without frontmatter.
 * @returns Single-line plain text.
 * @example
 * stripMarkdown("see [docs](https://x.y) and `code`"); // "see docs and code"
 */
export function stripMarkdown(body: string): string {
  return withoutFences(body)
    .replace(HEADING, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, " ")
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)*\|?\s*$/gm, " ")
    .replace(/\|/g, " ")
    .replace(/[*_~]{1,3}/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Build the search index for the given topics.
 *
 * One {@link SearchDoc} per sheet (including sheets inside directories), in the same display order as
 * `listAllSheets`. Body text is truncated to {@link MAX_TEXT_LENGTH} characters.
 *
 * @param topics - Topic slugs to include; defaults to all known topics.
 * @param root - Content root; overridable for tests.
 * @throws {Error} If any sheet has invalid frontmatter (propagated from the content loader).
 */
export function buildSearchIndex(
  topics: readonly string[] = TOPIC_SLUGS,
  root: string = CONTENT_ROOT,
): SearchDoc[] {
  return listAllSheets(topics, root).map((sheet) => {
    const body = readSheetBody(sheet, root);
    return {
      topic: sheet.topic,
      slug: sheet.slug,
      title: sheet.title,
      url: sheetHref(sheet),
      headings: extractHeadings(body),
      text: stripMarkdown(body).slice(0, MAX_TEXT_LENGTH),
    };
  });
}
