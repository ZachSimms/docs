/**
 * @file Build the playground's docs hovers for C++, Rust, GDScript, HTML and CSS from DevDocs.
 *
 * Usage: `bun scripts/build-hover-docs.ts [cpp rust gdscript html css]` (a few
 * minutes; the output is committed). For each language it picks entries from the DevDocs index,
 * fetches their pages (one fetch per page: fragment entries share it), and
 * keeps a signature, a one- or two-sentence summary and the docs path, in
 * `public/playground/hover/<lang>.json` with the docset's attribution.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Window } from "happy-dom";
import {
  DEVDOCS,
  pageUrl,
  parseIndex,
  parseManifest,
  splitFragment,
  type DocEntry,
  type Docset,
} from "../lib/playground/docs";
import type { HoverDocEntry, HoverDocFile, HoverLanguage } from "../lib/playground/hover-docs";

/** What to take from one docset. */
interface Selection {
  slug: string;
  /** Exact index names. */
  names?: readonly string[];
  /** Index names starting with one of these. */
  prefixes?: readonly string[];
  /** Index types (Godot: the class) to take whole. */
  types?: readonly string[];
  /** Extra test on the entry. */
  keep?(entry: DocEntry): boolean;
  /** Display name and lookup name for an index name. */
  rename?(name: string): string;
}

const CPP_MEMBERS = [
  "std::vector::",
  "std::basic_string::",
  "std::map::",
  "std::unordered_map::",
  "std::set::",
];

const SELECTIONS: Record<HoverLanguage, Selection> = {
  cpp: {
    slug: "cpp",
    names: [
      "std::vector",
      "std::array",
      "std::basic_string",
      "std::map",
      "std::unordered_map",
      "std::set",
      "std::unordered_set",
      "std::deque",
      "std::list",
      "std::pair",
      "std::tuple",
      "std::optional",
      "std::variant",
      "std::span",
      "std::basic_string_view",
      "std::unique_ptr",
      "std::shared_ptr",
      "std::make_unique",
      "std::make_shared",
      "std::move",
      "std::forward",
      "std::swap",
      "std::sort",
      "std::stable_sort",
      "std::find",
      "std::find_if",
      "std::count",
      "std::count_if",
      "std::accumulate",
      "std::reduce",
      "std::transform",
      "std::for_each",
      "std::max",
      "std::min",
      "std::clamp",
      "std::max_element",
      "std::min_element",
      "std::reverse",
      "std::unique",
      "std::copy",
      "std::fill",
      "std::iota",
      "std::binary_search",
      "std::lower_bound",
      "std::upper_bound",
      "std::remove_if",
      "std::all_of",
      "std::any_of",
      "std::none_of",
      "std::cout",
      "std::cin",
      "std::cerr",
      "std::endl",
      "std::getline",
      "std::printf",
      "std::println",
      "std::print",
      "std::format",
      "std::to_string",
      "std::stoi",
      "std::stod",
      "std::abs",
      "std::sqrt",
      "std::pow",
      "std::size",
      "std::begin",
      "std::end",
      "std::function",
      "std::thread",
      "std::mutex",
      "std::lock_guard",
      "std::chrono::duration",
      "std::ranges::sort",
      "std::views::filter",
      "std::views::transform",
      "std::views::iota",
    ],
    prefixes: CPP_MEMBERS,
    keep: (e) => !e.name.startsWith("deduction guides") && !e.name.includes("operator"),
    rename: (name) => name.replace(/^std::basic_string(?=::|$)/, "std::string"),
  },
  rust: {
    slug: "rust",
    names: [
      "println",
      "print",
      "eprintln",
      "format",
      "vec",
      "panic",
      "assert",
      "assert_eq",
      "todo",
      "dbg",
      "std::vec::Vec",
      "std::string::String",
      "std::option::Option",
      "std::result::Result",
      "std::collections::HashMap",
      "std::collections::HashSet",
      "std::collections::BTreeMap",
      "std::collections::VecDeque",
      "std::boxed::Box",
      "std::rc::Rc",
      "std::cell::RefCell",
      "std::sync::Arc",
      "std::sync::Mutex",
      "std::fmt::Display",
      "std::fmt::Debug",
      "std::clone::Clone",
      "std::iter::Iterator",
      "std::convert::From",
      "std::convert::Into",
      "std::default::Default",
      "std::cmp::PartialEq",
      "std::cmp::Ord",
    ],
    prefixes: [
      "std::vec::Vec::",
      "std::string::String::",
      "std::option::Option::",
      "std::result::Result::",
      "std::collections::HashMap::",
      "std::iter::Iterator::",
    ],
    keep: (e) => !e.name.includes("::from_raw") && !e.name.includes("unchecked"),
    rename: (name) => name.replace(/^std::(?:[a-z_]+::)*(?=[A-Z])/, ""),
  },
  gdscript: {
    slug: "godot~4.7",
    types: [
      "@GlobalScope",
      "@GDScript",
      "Object",
      "Node",
      "Node2D",
      "Node3D",
      "CanvasItem",
      "Control",
      "CharacterBody2D",
      "CharacterBody3D",
      "RigidBody2D",
      "Area2D",
      "Sprite2D",
      "AnimatedSprite2D",
      "Camera2D",
      "CollisionShape2D",
      "RayCast2D",
      "Timer",
      "Label",
      "Button",
      "InputEvent",
      "InputEventKey",
      "InputEventMouseButton",
      "PackedScene",
      "Resource",
      "AnimationPlayer",
      "AudioStreamPlayer",
      "TileMapLayer",
    ],
    // Enum and constant entries are long lists with little to say.
    keep: (e) => !/#(?:enum|constants)-/.test(e.path) && !/-constant-/.test(e.path),
    rename: (name) => name.replace(/\(\)$/, "").replace(/^@(?:GlobalScope|GDScript)\./, ""),
  },
  html: {
    slug: "html",
    types: ["Elements", "Global attributes", "Attributes"],
  },
  css: {
    slug: "css",
    keep: (e) =>
      (e.path.startsWith("properties/") && !/^-(?:webkit|moz|ms)-/.test(e.name)) ||
      /^at-rules\/@[a-z-]+$/.test(e.path) ||
      /^selectors\/:{1,2}[a-z-]+$/.test(e.path) ||
      /^[a-z-]+\(\)$/.test(e.name),
  },
};

/** Longest summary kept. */
const SUMMARY_MAX = 220;
/** Parallel page fetches. */
const CONCURRENCY = 16;
/** Give up on a stalled request after this long (and retry). */
const FETCH_TIMEOUT_MS = 30_000;

const root = path.join(import.meta.dir, "..");
const manifest = parseManifest(
  JSON.parse(readFileSync(path.join(root, "public", "playground", "docs-manifest.json"), "utf8")),
);

/** Squash whitespace. */
const squash = (text: string) => text.replace(/\s+/g, " ").trim();

/** One or two sentences, at most {@link SUMMARY_MAX} characters. */
function shorten(text: string): string {
  const clean = squash(text);
  // A sentence ends at . ! or ? followed by a capital (so "i.e. std::x" doesn't end one).
  const sentences = clean.split(/(?<=[.!?])\s+(?=[A-Z(`"'])/);
  let out = "";
  for (const sentence of sentences) {
    if (`${out} ${sentence}`.length > SUMMARY_MAX) break;
    out = out ? `${out} ${sentence}` : sentence;
  }
  if (!out)
    out = clean.length > SUMMARY_MAX ? `${clean.slice(0, SUMMARY_MAX - 1).trimEnd()}…` : clean;
  return out.trim();
}

/** Page furniture inside headings: version badges, source links, tooltips, permalinks. */
const CHROME = ".rightside, .since, .src, .tooltip, .headerlink, .anchor, .notable-traits";

/** An element's text without {@link CHROME}. */
function textWithoutChrome(element: Element): string {
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll(CHROME).forEach((e) => e.remove());
  return squash(copy.textContent ?? "")
    .replace(/[¶§ⓘ]|\u{1F517}/gu, "")
    .trim();
}

/** The first paragraph after `start` in document order that says something. */
function nextParagraph(doc: Document, start: Element | null): string {
  const paragraphs = [...doc.querySelectorAll("p")];
  for (const p of paragraphs) {
    if (start && !(start.compareDocumentPosition(p) & 4 /* FOLLOWING */) && !start.contains(p))
      continue;
    if (p.closest("details, table, .t-dcl-begin")) continue;
    const text = squash(p.textContent ?? "");
    // Godot class pages open with their inheritance chain.
    if (/^(?:Inherits|Inherited By):/.test(text)) continue;
    if (text.length > 20) return text;
  }
  return "";
}

/** Signature and summary of an entry on its page. */
function extract(
  doc: Document,
  entry: DocEntry,
  lang: HoverLanguage,
): { signature: string; summary: string } {
  const { fragment } = splitFragment(entry.path);
  const anchor = fragment ? doc.getElementById(decodeURIComponent(fragment)) : null;
  if (anchor) {
    const heading = anchor.matches("h1, h2, h3, h4, h5, dt")
      ? anchor
      : anchor.querySelector("h1, h2, h3, h4, h5, dt");
    return {
      signature: textWithoutChrome(heading ?? anchor),
      summary: nextParagraph(doc, anchor),
    };
  }
  const decl =
    lang === "cpp"
      ? doc.querySelector(".t-dcl pre, .t-dcl code")
      : lang === "rust"
        ? doc.querySelector("pre.item-decl, .item-decl pre")
        : null;
  const signature = decl ? textWithoutChrome(decl).slice(0, 200) : "";
  return { signature, summary: nextParagraph(doc, doc.querySelector("h1")) };
}

/** Fetch a page's HTML (DevDocs serves CORS-enabled static files). */
async function page(set: Docset, pagePath: string): Promise<string> {
  // Index paths are already percent-encoded (`class_%40gdscript`); pageUrl encodes them once more, as DevDocs needs.
  const url = pageUrl(set, pagePath);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) }).catch(
      () => null,
    );
    if (response?.ok) return response.text();
    if (response?.status === 404) return "";
    await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
  }
  throw new Error(`${url}: failed three times`);
}

/** Build one language's file. */
async function build(lang: HoverLanguage, selection: Selection): Promise<HoverDocFile> {
  const set = manifest.find((d) => d.slug === selection.slug);
  if (!set) throw new Error(`no docset ${selection.slug} in the manifest`);
  const index = parseIndex(
    set.slug,
    await (await fetch(`${DEVDOCS}${set.slug}/index.json?${set.mtime}`)).json(),
  );
  const names = new Set(selection.names ?? []);
  const chosen = index.filter(
    (e) =>
      (names.has(e.name) ||
        selection.prefixes?.some((p) => e.name.startsWith(p)) ||
        selection.types?.includes(e.type) ||
        (!selection.names && !selection.prefixes && !selection.types)) &&
      (selection.keep?.(e) ?? true),
  );
  const missing = [...names].filter((n) => !index.some((e) => e.name === n));
  if (missing.length) console.warn(`${lang}: not in the index: ${missing.join(", ")}`);

  const byPage = new Map<string, DocEntry[]>();
  for (const entry of chosen) {
    const key = splitFragment(entry.path).page;
    byPage.set(key, [...(byPage.get(key) ?? []), entry]);
  }
  const pages = [...byPage.entries()];
  const entries: HoverDocEntry[] = [];
  const window = new Window();
  for (let i = 0; i < pages.length; i += CONCURRENCY) {
    const batch = pages.slice(i, i + CONCURRENCY);
    const htmls = await Promise.all(batch.map(([p]) => page(set, p)));
    batch.forEach(([, pageEntries], j) => {
      if (!htmls[j]) return;
      const doc = new window.DOMParser().parseFromString(
        htmls[j]!,
        "text/html",
      ) as unknown as Document;
      for (const entry of pageEntries) {
        const { signature, summary } = extract(doc, entry, lang);
        if (!summary) continue;
        const name = selection.rename?.(entry.name) ?? entry.name;
        entries.push({
          name,
          ...(signature && signature !== name ? { signature } : {}),
          summary: shorten(summary),
          path: entry.path,
        });
      }
    });
    process.stdout.write(
      `\r${lang}: ${Math.min(i + CONCURRENCY, pages.length)}/${pages.length} pages`,
    );
  }
  await window.happyDOM.close();
  process.stdout.write(`, ${entries.length} entries\n`);
  entries.sort((a, b) => a.name.localeCompare(b.name));
  return { slug: set.slug, docs: set.name, attribution: set.attribution, entries };
}

/** Languages to build (all when none are named). */
const only = process.argv.slice(2) as HoverLanguage[];
const outDir = path.join(root, "public", "playground", "hover");
mkdirSync(outDir, { recursive: true });
for (const [lang, selection] of Object.entries(SELECTIONS) as [HoverLanguage, Selection][]) {
  if (only.length > 0 && !only.includes(lang)) continue;
  const file = await build(lang, selection);
  const out = path.join(outDir, `${lang}.json`);
  writeFileSync(out, `${JSON.stringify(file)}\n`);
  console.log(
    `  ${path.relative(root, out)}: ${Math.round(JSON.stringify(file).length / 1024)} KB`,
  );
}
