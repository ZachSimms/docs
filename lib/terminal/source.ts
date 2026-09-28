/**
 * @file The Markdown (MDX) sources the terminal's `md` pane shows: every sheet, every
 * directory's `index.mdx` and every post, served as they are on disk under `/source/`.
 *
 * Server only (reads `content/` and `posts/`). The route handler at
 * `app/source/[...path]/route.ts` prerenders one file per source; the site tree gives
 * each page its `source` URL (see `lib/terminal/tree.ts`).
 *
 * | Page                        | Source                              |
 * | --------------------------- | ----------------------------------- |
 * | `/python/overview/`         | `/source/python/overview.md`        |
 * | `/python/language/strings/` | `/source/python/language/strings.md`|
 * | `/python/language/`         | `/source/python/language/index.md`  |
 * | `/blog/hello/`              | `/source/blog/hello.md`             |
 */

import fs from "node:fs";
import path from "node:path";
import { CONTENT_ROOT, GROUP_INDEX, listAllGroups, listAllSheets, type SheetRef } from "../content";
import { listPosts, POSTS_ROOT } from "../posts";
import { TOPIC_SLUGS } from "../topics";

/** Where every source is served. */
export const SOURCE_PREFIX = "/source/";

/** One source file and the URL segments it is served at. */
export interface SourceFile {
  /** URL segments after `/source/`, the last ending in `.md`. */
  readonly segments: readonly string[];
  /** Absolute path of the `.mdx` file. */
  readonly file: string;
}

/** Where the builder reads from; overridable for tests. */
export interface SourceRoots {
  readonly content?: string;
  readonly posts?: string;
  readonly topics?: readonly string[];
}

/** URL of a sheet's source. */
export function sheetSourceHref(sheet: SheetRef): string {
  const dir = sheet.group === undefined ? [sheet.topic] : [sheet.topic, sheet.group];
  return `${SOURCE_PREFIX}${[...dir, `${sheet.slug}.md`].join("/")}`;
}

/** URL of a directory's `index.mdx`. */
export function groupSourceHref(group: { topic: string; slug: string }): string {
  return `${SOURCE_PREFIX}${group.topic}/${group.slug}/index.md`;
}

/** URL of a post's source. */
export function postSourceHref(post: { slug: string }): string {
  return `${SOURCE_PREFIX}blog/${post.slug}.md`;
}

/** The URL segments of a source URL (what the route's `[...path]` receives). */
function segmentsOf(href: string): string[] {
  return href.slice(SOURCE_PREFIX.length).split("/");
}

/**
 * Every source the site serves: sheets, directory intros and posts. Drafts and partials
 * (`_`-prefixed) are never listed, as they are never pages.
 *
 * @throws {Error} On invalid content, as the content and post loaders do.
 */
export function listSources(roots: SourceRoots = {}): SourceFile[] {
  const content = roots.content ?? CONTENT_ROOT;
  const posts = roots.posts ?? POSTS_ROOT;
  const topics = roots.topics ?? TOPIC_SLUGS;
  return [
    ...listAllSheets(topics, content).map((sheet) => ({
      segments: segmentsOf(sheetSourceHref(sheet)),
      file: `${path.join(content, sheet.topic, ...(sheet.group ? [sheet.group] : []), sheet.slug)}.mdx`,
    })),
    ...listAllGroups(topics, content).map((group) => ({
      segments: segmentsOf(groupSourceHref(group)),
      file: path.join(content, group.topic, group.slug, GROUP_INDEX),
    })),
    ...listPosts(posts).map((post) => ({
      segments: segmentsOf(postSourceHref(post)),
      file: path.join(posts, `${post.slug}.mdx`),
    })),
  ];
}

/**
 * The text of the source served at `segments`, or `undefined` for anything that is not
 * a listed source (so no request can read another file).
 */
export function readSource(
  segments: readonly string[],
  roots: SourceRoots = {},
): string | undefined {
  const wanted = segments.join("/");
  const found = listSources(roots).find((source) => source.segments.join("/") === wanted);
  return found ? fs.readFileSync(found.file, "utf8") : undefined;
}
