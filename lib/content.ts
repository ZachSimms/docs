/**
 * @file Content loader: reads cheatsheet frontmatter from `content/<topic>/<slug>.mdx`
 * and from one level of directories, `content/<topic>/<directory>/<slug>.mdx`, where
 * each directory is named and ordered by its own `index.mdx`.
 *
 * Server/build-time only (uses `node:fs`). Pages call {@link listTopicEntries},
 * {@link listGroupSheets}, {@link listAllSheets}, {@link listAllGroups},
 * {@link getSheetMeta}, {@link getGroupMeta} and {@link getGroupSheetMeta} to build
 * numbered lists and `generateStaticParams`; the MDX body itself is loaded
 * separately by the page through a dynamic `import()`.
 *
 * Security: every topic and slug that reaches the filesystem must satisfy
 * {@link SEGMENT_PATTERN}, so path traversal is impossible even if
 * `dynamicParams` were ever switched on.
 */

import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import matter from "gray-matter";
import { frontmatterSchema, type Frontmatter } from "./schema";
import { TOPIC_SLUGS } from "./topics";

/** Metadata for one cheatsheet, as listed on topic, directory and index pages. */
export interface Sheet {
  /** Topic slug, i.e. the folder under `content/`. */
  readonly topic: string;
  /** Directory slug when the sheet lives in `content/<topic>/<group>/`; absent for loose sheets. */
  readonly group?: string;
  /** File name without `.mdx`; becomes the last URL segment. */
  readonly slug: string;
  /** Frontmatter title. */
  readonly title: string;
  /** Frontmatter date, normalised to `YYYY-MM-DD`. */
  readonly date: string;
  /**
   * Optional explicit position from frontmatter. Ordered sheets are listed
   * before unordered ones, smallest first; see {@link compareSheets}.
   */
  readonly order?: number;
  /** Zero-based position in the displayed list: the top row is `00.`. */
  readonly number: number;
}

/**
 * A directory inside a topic (`content/<topic>/<slug>/`), described by its
 * `index.mdx` frontmatter. Only one level of directories is supported.
 */
export interface Group {
  /** Topic slug. */
  readonly topic: string;
  /** Directory name; becomes the second URL segment. */
  readonly slug: string;
  /** `index.mdx` title. */
  readonly title: string;
  /** `index.mdx` date, normalised to `YYYY-MM-DD`. */
  readonly date: string;
  /** Optional position among the topic's directories and loose sheets. */
  readonly order?: number;
  /** Zero-based position in the topic's list. */
  readonly number: number;
}

/** One row of a topic page: either a directory or a loose sheet. */
export type TopicEntry =
  (Group & { readonly kind: "group" }) | (Sheet & { readonly kind: "sheet" });

/** Enough of a sheet to locate its file and URL. */
export type SheetRef = Pick<Sheet, "topic" | "group" | "slug">;

/** A sheet before numbering, i.e. straight from the file. */
type SheetMeta = Omit<Sheet, "number">;

/** A directory before numbering, with its (unnumbered) sheets. */
interface GroupMeta extends Omit<Group, "number"> {
  readonly sheets: readonly SheetMeta[];
}

/** Everything read from one topic folder. */
interface TopicMeta {
  /** Loose sheets directly in the topic folder. */
  readonly sheets: readonly SheetMeta[];
  /** Directories, each with its sheets. */
  readonly groups: readonly GroupMeta[];
}

/** File that names and orders a directory; never listed as a sheet. */
export const GROUP_INDEX = "index.mdx";

/** Absolute path of the content folder in the current working directory. */
export const CONTENT_ROOT = path.join(process.cwd(), "content");

/** URL segments (topics and slugs) are lowercase kebab-case only; anything else never touches the disk. */
export const SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Whether a string is a safe topic or slug segment.
 *
 * @param segment - Candidate URL segment.
 * @returns `true` for lowercase kebab-case such as `"ml-ai"`; `false` for
 *   anything else, including `".."`, uppercase letters and empty strings.
 */
export function isValidSegment(segment: string): boolean {
  return SEGMENT_PATTERN.test(segment);
}

/**
 * Whether a file is a partial: an `_`-prefixed MDX file meant to be imported
 * into other sheets (`import Shared from "./_shared.mdx"`). Partials have no
 * frontmatter and never become pages.
 */
export function isPartial(fileName: string): boolean {
  return fileName.startsWith("_");
}

/**
 * Read and validate the frontmatter of one MDX file.
 *
 * @param fullPath - Absolute path of the file.
 * @returns The parsed, normalised frontmatter.
 * @throws {Error} If the file cannot be read, or its frontmatter fails
 *   {@link frontmatterSchema}. The message names the file and the failing fields.
 */
function readFrontmatter(fullPath: string): Frontmatter {
  let raw: string;
  try {
    raw = fs.readFileSync(fullPath, "utf8");
  } catch (error) {
    throw new Error(
      `Cannot read ${fullPath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  const parsed = frontmatterSchema.safeParse(matter(raw).data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid frontmatter in ${fullPath}: ${issues}`);
  }
  return parsed.data;
}

/** The listable fields of a frontmatter block, dropping `order` when absent. */
function listFields(data: Frontmatter): Pick<SheetMeta, "title" | "date" | "order"> {
  return {
    title: data.title,
    date: data.date,
    ...(data.order === undefined ? {} : { order: data.order }),
  };
}

/** Whether a directory entry is a listable sheet file (not a partial, not an `index.mdx`). */
function isSheetFile(entry: fs.Dirent): boolean {
  return (
    entry.isFile() &&
    entry.name.endsWith(".mdx") &&
    !isPartial(entry.name) &&
    entry.name !== GROUP_INDEX
  );
}

/** `_`-prefixed (drafts, partials) and `.`-prefixed (hidden) entries are never content. */
function isIgnoredName(name: string): boolean {
  return name.startsWith("_") || name.startsWith(".");
}

/**
 * Read every sheet file directly inside one folder.
 *
 * @param dir - Absolute folder path.
 * @param ref - Topic and, for directories, group the sheets belong to.
 * @returns Unsorted sheet metadata; unsafe slugs are dropped.
 */
function readSheetsIn(dir: string, ref: { topic: string; group?: string }): SheetMeta[] {
  const inGroup = ref.group !== undefined;
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter(isSheetFile)
    .map((entry) => ({
      topic: ref.topic,
      ...(inGroup ? { group: ref.group } : {}),
      slug: entry.name.replace(/\.mdx$/, ""),
      ...listFields(readFrontmatter(path.join(dir, entry.name))),
    }))
    .filter((sheet) => isValidSegment(sheet.slug));
}

/**
 * The content directories directly inside a folder: every sub-directory except
 * `_`- and `.`-prefixed ones.
 *
 * @throws {Error} If a directory name is not lowercase kebab-case, so a folder
 *   such as `Web_APIs/` fails the build instead of silently disappearing.
 */
function contentDirs(dir: string): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !isIgnoredName(entry.name))
    .map((entry) => {
      if (!isValidSegment(entry.name)) {
        throw new Error(
          `Directory name "${path.join(dir, entry.name)}" must be lowercase kebab-case`,
        );
      }
      return entry.name;
    });
}

/**
 * Read one directory: its `index.mdx` metadata and its sheets.
 *
 * @throws {Error} If `index.mdx` is missing or invalid, or the directory
 *   contains another directory (only one level of nesting is supported).
 */
function readGroup(topicDir: string, topic: string, slug: string): GroupMeta {
  const dir = path.join(topicDir, slug);
  const indexPath = path.join(dir, GROUP_INDEX);
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Directory ${dir} has no ${GROUP_INDEX}; add one with a title and date`);
  }
  const nested = fs
    .readdirSync(dir, { withFileTypes: true })
    .find((entry) => entry.isDirectory() && !isIgnoredName(entry.name));
  if (nested) {
    throw new Error(
      `Nested directory ${path.join(dir, nested.name)} is not supported; ` +
        `only content/<topic>/<directory>/<sheet>.mdx`,
    );
  }
  return {
    topic,
    slug,
    ...listFields(readFrontmatter(indexPath)),
    sheets: readSheetsIn(dir, { topic, group: slug }),
  };
}

/**
 * Read one topic folder: its loose sheets and its directories, unsorted.
 *
 * Memoised with React `cache` per `(topic, root)` for the lifetime of a render
 * or build, so the many pages that list the same topic share one directory read.
 * Invalid topic segments and missing folders yield nothing rather than an error;
 * non-`.mdx` files, `_`/`.`-prefixed entries and files with unsafe names are skipped.
 *
 * @throws {Error} On invalid frontmatter, a directory without `index.mdx`, a
 *   directory name that is not kebab-case, nested directories, a topic-level
 *   `index.mdx`, or a directory and a sheet sharing a slug.
 */
const readTopicMeta = cache((topic: string, root: string): TopicMeta => {
  if (!isValidSegment(topic)) return { sheets: [], groups: [] };
  const dir = path.join(root, topic);
  if (!fs.existsSync(dir)) return { sheets: [], groups: [] };
  if (fs.existsSync(path.join(dir, GROUP_INDEX))) {
    throw new Error(
      `${path.join(dir, GROUP_INDEX)}: ${GROUP_INDEX} is reserved for directories; rename the sheet`,
    );
  }
  const sheets = readSheetsIn(dir, { topic });
  const groups = contentDirs(dir).map((slug) => readGroup(dir, topic, slug));
  const clash = groups.find((group) => sheets.some((sheet) => sheet.slug === group.slug));
  if (clash) {
    throw new Error(
      `${path.join(dir, clash.slug)}/ and ${path.join(dir, clash.slug)}.mdx share a URL; rename one`,
    );
  }
  return { sheets, groups };
});

/** The fields {@link compareSheets} looks at, shared by sheets and directories. */
type Sortable = Pick<SheetMeta, "topic" | "group" | "slug" | "date" | "order">;

/**
 * Display-order comparator.
 *
 * 1. Sheets with a frontmatter `order` come before sheets without one.
 * 2. Among ordered sheets, smaller `order` first.
 * 3. Otherwise newest date first, then topic, directory and slug, so the
 *    output is stable regardless of filesystem order.
 *
 * Directories and sheets share it, so a topic page can interleave them.
 */
function compareSheets(a: Sortable, b: Sortable): number {
  const aOrder = a.order ?? Number.POSITIVE_INFINITY;
  const bOrder = b.order ?? Number.POSITIVE_INFINITY;
  if (aOrder !== bOrder) return aOrder < bOrder ? -1 : 1;
  return (
    b.date.localeCompare(a.date) ||
    a.topic.localeCompare(b.topic) ||
    (a.group ?? "").localeCompare(b.group ?? "") ||
    a.slug.localeCompare(b.slug)
  );
}

/**
 * Sort into display order; see {@link compareSheets}.
 *
 * @returns A new array; the input is not mutated.
 */
function sortForDisplay<T extends Sortable>(items: readonly T[]): T[] {
  return [...items].sort(compareSheets);
}

/**
 * Assign display numbers to an already-sorted list from the top down: the
 * first entry gets `0` (rendered `00.`), the last gets `N-1`.
 */
function numberSheets<T extends object>(sorted: readonly T[]): (T & { number: number })[] {
  return sorted.map((item, index) => ({ ...item, number: index }));
}

/** Strip the nested sheet list off a directory before it is numbered. */
function groupFields(group: GroupMeta): Omit<Group, "number"> {
  return {
    topic: group.topic,
    slug: group.slug,
    title: group.title,
    date: group.date,
    ...(group.order === undefined ? {} : { order: group.order }),
  };
}

/**
 * URL of a sheet: `/<topic>/<slug>/`, or `/<topic>/<group>/<slug>/` inside a directory.
 *
 * @example
 * sheetHref({ topic: "typescript", group: "language", slug: "objects" });
 * // "/typescript/language/objects/"
 */
export function sheetHref(sheet: SheetRef): string {
  return sheet.group === undefined
    ? `/${sheet.topic}/${sheet.slug}/`
    : `/${sheet.topic}/${sheet.group}/${sheet.slug}/`;
}

/** URL of a directory page: `/<topic>/<slug>/`. */
export function groupHref(group: Pick<Group, "topic" | "slug">): string {
  return `/${group.topic}/${group.slug}/`;
}

/**
 * The loose sheets of one topic (not those inside directories), in display
 * order and numbered within the topic.
 *
 * @param topic - Topic slug.
 * @param root - Content root; overridable for tests.
 * @returns Possibly empty list. Unknown or unsafe topics give `[]`.
 * @throws {Error} If a file in the folder has invalid frontmatter.
 */
export function listSheets(topic: string, root: string = CONTENT_ROOT): Sheet[] {
  return numberSheets(sortForDisplay(readTopicMeta(topic, root).sheets));
}

/**
 * Everything a topic page lists: its directories and loose sheets, merged in
 * display order (see {@link compareSheets}) and numbered from `00.`.
 *
 * @param topic - Topic slug.
 * @param root - Content root; overridable for tests.
 * @throws {Error} On invalid content; see {@link readTopicMeta}.
 */
export function listTopicEntries(topic: string, root: string = CONTENT_ROOT): TopicEntry[] {
  const { sheets, groups } = readTopicMeta(topic, root);
  const entries = [
    ...groups.map((group) => ({ ...groupFields(group), kind: "group" as const })),
    ...sheets.map((sheet) => ({ ...sheet, kind: "sheet" as const })),
  ];
  return numberSheets(sortForDisplay(entries));
}

/**
 * The sheets inside one directory, in display order and numbered within it.
 *
 * @param topic - Topic slug.
 * @param group - Directory slug.
 * @param root - Content root; overridable for tests.
 * @returns Possibly empty list; unknown or unsafe directories give `[]`.
 */
export function listGroupSheets(
  topic: string,
  group: string,
  root: string = CONTENT_ROOT,
): Sheet[] {
  const found = readTopicMeta(topic, root).groups.find((g) => g.slug === group);
  return found ? numberSheets(sortForDisplay(found.sheets)) : [];
}

/**
 * A directory's metadata, numbered within its topic's list.
 *
 * @returns The directory, or `undefined` if the topic or directory is unknown or unsafe.
 */
export function getGroupMeta(
  topic: string,
  group: string,
  root: string = CONTENT_ROOT,
): Group | undefined {
  return listAllGroups([topic], root).find((g) => g.slug === group);
}

/**
 * Every directory across the given topics, in topic order then display order,
 * each numbered by its position in its topic's list (see {@link listTopicEntries}).
 * Used by `generateStaticParams` of the `[topic]/[slug]` route.
 */
export function listAllGroups(
  topics: readonly string[] = TOPIC_SLUGS,
  root: string = CONTENT_ROOT,
): Group[] {
  return topics.flatMap((topic) =>
    listTopicEntries(topic, root).flatMap((entry) =>
      entry.kind === "group"
        ? [{ ...groupFields({ ...entry, sheets: [] }), number: entry.number }]
        : [],
    ),
  );
}

/**
 * Every sheet across the given topics, loose and inside directories, in
 * display order and numbered globally. Used by `/sheets/`, the search index
 * and `generateStaticParams`.
 *
 * @param topics - Topic slugs to include; defaults to all known topics.
 * @param root - Content root; overridable for tests.
 * @throws {Error} If any file has invalid frontmatter.
 */
export function listAllSheets(
  topics: readonly string[] = TOPIC_SLUGS,
  root: string = CONTENT_ROOT,
): Sheet[] {
  const all = topics.flatMap((topic) => {
    const { sheets, groups } = readTopicMeta(topic, root);
    return [...sheets, ...groups.flatMap((group) => group.sheets)];
  });
  return numberSheets(sortForDisplay(all));
}

/**
 * The Markdown body of a sheet (frontmatter removed), as written on disk.
 *
 * @param sheet - Topic, optional directory and slug of the sheet.
 * @param root - Content root; overridable for tests.
 * @returns The raw MDX source after the frontmatter block.
 * @throws {Error} If any segment is unsafe or the file cannot be read.
 */
export function readSheetBody(sheet: SheetRef, root: string = CONTENT_ROOT): string {
  const segments = [sheet.topic, ...(sheet.group === undefined ? [] : [sheet.group]), sheet.slug];
  if (!segments.every(isValidSegment)) {
    throw new Error(`Invalid sheet path: ${segments.join("/")}`);
  }
  const raw = fs.readFileSync(`${path.join(root, ...segments)}.mdx`, "utf8");
  return matter(raw).content;
}

/**
 * Metadata for a loose sheet, numbered within its topic.
 *
 * @param topic - Topic slug.
 * @param slug - Sheet slug (file name without `.mdx`).
 * @param root - Content root; overridable for tests.
 * @returns The sheet, or `undefined` if the topic or slug is unknown or unsafe.
 */
export function getSheetMeta(
  topic: string,
  slug: string,
  root: string = CONTENT_ROOT,
): Sheet | undefined {
  if (!isValidSegment(slug)) return undefined;
  return listSheets(topic, root).find((sheet) => sheet.slug === slug);
}

/**
 * Metadata for a sheet inside a directory, numbered within that directory.
 *
 * @returns The sheet, or `undefined` if any segment is unknown or unsafe.
 */
export function getGroupSheetMeta(
  topic: string,
  group: string,
  slug: string,
  root: string = CONTENT_ROOT,
): Sheet | undefined {
  if (!isValidSegment(slug)) return undefined;
  return listGroupSheets(topic, group, root).find((sheet) => sheet.slug === slug);
}
