/**
 * @file Docs hovers for languages without an in-browser language server: C++, Rust, GDScript, HTML and CSS.
 *
 * Pure. `scripts/build-hover-docs.ts` writes one JSON file per language from
 * DevDocs (signature, short summary, docs path, attribution); the editor looks
 * up the word under the pointer here. Names match fully or by their last
 * segment (`v.push_back` finds `std::vector::push_back`).
 */

import { z } from "zod";
import type { EditorMode } from "./languages";

/** Languages with a hover file. */
export const HOVER_LANGUAGES = ["cpp", "rust", "gdscript", "html", "css"] as const;
export type HoverLanguage = (typeof HOVER_LANGUAGES)[number];

/** One documented name. */
export interface HoverDocEntry {
  readonly name: string;
  readonly signature?: string;
  readonly summary: string;
  /** Page path in the DevDocs docset (with a `#fragment` for members). */
  readonly path: string;
}

/** A language's hover file. */
export interface HoverDocFile {
  readonly slug: string;
  /** The docset's display name. */
  readonly docs: string;
  readonly attribution: string;
  readonly entries: readonly HoverDocEntry[];
}

const fileSchema = z.object({
  slug: z.string(),
  docs: z.string(),
  attribution: z.string(),
  entries: z
    .array(
      z.object({
        name: z.string().min(1),
        signature: z.string().optional(),
        summary: z.string(),
        path: z.string(),
      }),
    )
    .max(20_000),
});

/** Parse a fetched hover file. */
export function parseHoverFile(json: unknown): HoverDocFile {
  return fileSchema.parse(json);
}

/** Where a language's file is served. */
export const hoverFileUrl = (lang: HoverLanguage) => `/playground/hover/${lang}.json`;

/** The hover language for an editor mode, if there is one. */
export function hoverLanguageFor(mode: EditorMode): HoverLanguage | null {
  return (HOVER_LANGUAGES as readonly string[]).includes(mode) ? (mode as HoverLanguage) : null;
}

/** Characters that make up a (qualified) name, per language. */
const NAME_CHAR: Record<HoverLanguage, RegExp> = {
  cpp: /[\w:]/,
  rust: /[\w:!]/,
  gdscript: /[\w.@]/,
  html: /[\w-]/,
  css: /[\w@-]/,
};

/** The name under `offset` in `line`, with its span; `null` off a name. */
export function nameAt(
  line: string,
  offset: number,
  lang: HoverLanguage,
): { from: number; to: number; name: string } | null {
  const char = NAME_CHAR[lang];
  let from = offset;
  let to = offset;
  while (from > 0 && char.test(line[from - 1]!)) from -= 1;
  while (to < line.length && char.test(line[to]!)) to += 1;
  // Trim separators left at the ends (`a::` while typing, `node.`, a macro's `!`).
  while (from < to && /[:.!]/.test(line[from]!)) from += 1;
  while (to > from && /[:.!]/.test(line[to - 1]!)) to -= 1;
  if (from >= to || !/\w/.test(line.slice(from, to))) return null;
  // CSS pseudo-classes and elements: take the colons before the word.
  if (lang === "css") while (from > 0 && line[from - 1] === ":") from -= 1;
  return { from, to, name: line.slice(from, to) };
}

/** When only a member name is known (`v.push_back`), these owners come first. */
const COMMON_OWNERS: Record<HoverLanguage, readonly string[]> = {
  cpp: ["std::vector::", "std::string::", "std::map::"],
  rust: ["Vec::", "String::", "Option::", "Result::", "Iterator::", "HashMap::"],
  gdscript: ["Node.", "Node2D.", "CharacterBody2D.", "Object."],
  html: [],
  css: [],
};

/** Rank of an entry among members with the same name (lower first). */
function ownerRank(name: string, lang: HoverLanguage): number {
  const rank = COMMON_OWNERS[lang].findIndex((owner) => name.startsWith(owner));
  return rank === -1 ? COMMON_OWNERS[lang].length : rank;
}

/** Last segment of a qualified name. */
const lastSegment = (name: string) => name.split(/::|\./).at(-1) ?? name;

/** Lookup keys for a name (exact, and its last segment). */
function keys(name: string, lang: HoverLanguage): string[] {
  const base = lang === "html" || lang === "css" ? name.toLowerCase() : name;
  return [...new Set([base, base.replace(/^std::/, ""), lastSegment(base).replace(/\(\)$/, "")])];
}

/** A built index: key → entries. */
export type HoverIndex = ReadonlyMap<string, readonly HoverDocEntry[]>;

/** Index a file's entries by every key they answer to. */
export function buildHoverIndex(file: HoverDocFile, lang: HoverLanguage): HoverIndex {
  const index = new Map<string, HoverDocEntry[]>();
  for (const entry of file.entries)
    for (const key of keys(entry.name, lang)) index.set(key, [...(index.get(key) ?? []), entry]);
  return index;
}

/**
 * Entries for a name: an exact match first, then (for `x.method` or
 * `Type::method`) the members with that last segment.
 *
 * @returns At most `limit` entries, and how many matched in all.
 */
export function lookupHover(
  index: HoverIndex,
  name: string,
  lang: HoverLanguage,
  limit = 3,
): { entries: HoverDocEntry[]; total: number } {
  const wanted = lang === "html" || lang === "css" ? name.toLowerCase() : name;
  const candidates = [wanted, wanted.replace(/^std::/, "")];
  for (const candidate of candidates) {
    const exact = index
      .get(candidate)
      ?.filter((e) => keys(e.name, lang)[0] === candidate || e.name === `std::${candidate}`);
    if (exact?.length) return { entries: exact.slice(0, limit), total: exact.length };
  }
  const segment = lastSegment(wanted);
  const qualifier = wanted
    .slice(0, Math.max(0, wanted.length - segment.length))
    .replace(/(?:::|\.)$/, "");
  const members = [...(index.get(segment) ?? [])].sort(
    (a, b) =>
      Number(qualifier !== "" && b.name.includes(qualifier)) -
        Number(qualifier !== "" && a.name.includes(qualifier)) ||
      ownerRank(a.name, lang) - ownerRank(b.name, lang) ||
      a.name.length - b.name.length,
  );
  return { entries: members.slice(0, limit), total: members.length };
}

/** Completion labels: every entry's last segment, once. */
export function completionNames(
  file: HoverDocFile,
): { label: string; detail: string; info: string }[] {
  const seen = new Map<string, { label: string; detail: string; info: string }>();
  for (const entry of file.entries) {
    const label = lastSegment(entry.name).replace(/\(\)$/, "");
    if (!/^[A-Za-z_][\w-]*$/.test(label) || seen.has(label)) continue;
    seen.set(label, { label, detail: entry.name, info: entry.summary });
  }
  return [...seen.values()];
}
