/**
 * @file Copy-ready code snippets for the reference panel's Snippets tab.
 *
 * Pure data and helpers; safe on the server and in tests. Each set is one
 * language's (or framework's) snippets, in its own module and loaded with a
 * dynamic `import()` the first time the tab shows it, so the playground's
 * bundle only carries the sets a reader opens. Every project type lists the
 * sets that fit it ({@link SNIPPETS_FOR}); the tab starts on the set that
 * matches the open file ({@link defaultSnippetSet}).
 *
 * Snippets are complete programs (or files) wherever the language allows, so
 * they run as pasted. They are checked by `tests/unit/playground-snippets.test.ts`.
 */

import type { EditorMode, LanguageId } from "../languages";

/** One snippet. */
export interface Snippet {
  /** Unique within its set (`hello`, `classes`, …). */
  readonly id: string;
  readonly title: string;
  /** One line under the title: what it shows, or where it goes. */
  readonly note?: string;
  /** The file the snippet is meant to be, when it's one file of several (`math.js`). */
  readonly file?: string;
  /** More words the filter matches (`lambda closure`, `try catch`). */
  readonly keywords?: string;
  /** The code, ending in one newline. */
  readonly code: string;
}

/** Every snippet set. */
export const SNIPPET_SET_IDS = [
  "javascript",
  "typescript",
  "python",
  "cpp",
  "rust",
  "gdscript",
  "html",
  "css",
  "dom",
  "react",
  "bun",
  "hono",
  "markdown",
] as const;

/** One snippet set. */
export type SnippetSetId = (typeof SNIPPET_SET_IDS)[number];

/** What the tab shows about a set before its snippets load. */
export interface SnippetSetInfo {
  readonly id: SnippetSetId;
  readonly label: string;
  /** Highlighting, and which open files the set matches. */
  readonly mode: EditorMode;
  /** One line above the list. */
  readonly note: string;
}

/** The sets, by id. */
export const SNIPPET_SETS: Readonly<Record<SnippetSetId, SnippetSetInfo>> = {
  javascript: {
    id: "javascript",
    label: "JavaScript",
    mode: "javascript",
    note: "Each snippet is a whole script: paste it into main.js, or take the lines you need.",
  },
  typescript: {
    id: "typescript",
    label: "TypeScript",
    mode: "typescript",
    note: "Each snippet is a whole script and type-checks under strict mode.",
  },
  python: {
    id: "python",
    label: "Python",
    mode: "python",
    note: "Each snippet is a whole script for Python 3.14: paste it into main.py.",
  },
  cpp: {
    id: "cpp",
    label: "C++",
    mode: "cpp",
    note: "Each snippet is a whole C++23 program: paste it over main.cpp, or take the parts you need.",
  },
  rust: {
    id: "rust",
    label: "Rust",
    mode: "rust",
    note: "Each snippet is a whole program (edition 2024, standard library only): paste it over src/main.rs.",
  },
  gdscript: {
    id: "gdscript",
    label: "GDScript",
    mode: "gdscript",
    note: "Each snippet is a whole script for Godot 4 (extends Node, so _ready() runs): paste it over main.gd.",
  },
  html: {
    id: "html",
    label: "HTML",
    mode: "html",
    note: "Markup for index.html.",
  },
  css: {
    id: "css",
    label: "CSS",
    mode: "css",
    note: "Rules for your stylesheet.",
  },
  dom: {
    id: "dom",
    label: "DOM (browser)",
    mode: "javascript",
    note: "Browser scripts; each is valid JavaScript and TypeScript.",
  },
  react: {
    id: "react",
    label: "React",
    mode: "tsx",
    note: "Components in TSX: paste one into App.tsx, or into a file of its own and import it.",
  },
  bun: {
    id: "bun",
    label: "Bun",
    mode: "typescript",
    note: "Bun's APIs as the playground emulates them (Bun.serve, Bun.file, Bun.env).",
  },
  hono: {
    id: "hono",
    label: "Hono",
    mode: "typescript",
    note: "Hono apps: each ends in export default app.",
  },
  markdown: {
    id: "markdown",
    label: "Markdown",
    mode: "markdown",
    note: "GitHub Flavored Markdown, as the preview renders it.",
  },
};

/** The sets each project type offers, the most specific first. */
export const SNIPPETS_FOR: Readonly<Record<LanguageId, readonly SnippetSetId[]>> = {
  javascript: ["javascript"],
  typescript: ["typescript"],
  web: ["html", "css", "dom", "javascript"],
  "web-ts": ["html", "css", "dom", "typescript"],
  react: ["react", "typescript", "css"],
  python: ["python"],
  bun: ["bun", "typescript"],
  hono: ["hono", "bun", "typescript"],
  cpp: ["cpp"],
  rust: ["rust"],
  gdscript: ["gdscript"],
  markdown: ["markdown"],
};

/** Modes that read the same code (a `.js` file takes TypeScript-free JavaScript snippets, and so on). */
const MODE_FAMILY: Partial<Record<EditorMode, readonly EditorMode[]>> = {
  javascript: ["javascript", "jsx"],
  jsx: ["jsx", "javascript"],
  typescript: ["typescript", "tsx"],
  tsx: ["tsx", "typescript"],
};

/**
 * The set to show first: the project's first set written in the open file's
 * language (exact mode first, then its family), else the project's first set.
 *
 * @param language - The project type.
 * @param mode - The open file's editor mode (from `modeForPath`).
 */
export function defaultSnippetSet(language: LanguageId, mode: EditorMode): SnippetSetId {
  const sets = SNIPPETS_FOR[language];
  for (const candidate of MODE_FAMILY[mode] ?? [mode]) {
    const match = sets.find((id) => SNIPPET_SETS[id].mode === candidate);
    if (match) return match;
  }
  return sets[0];
}

/** Type guard for {@link SnippetSetId}. */
export function isSnippetSetId(value: unknown): value is SnippetSetId {
  return typeof value === "string" && (SNIPPET_SET_IDS as readonly string[]).includes(value);
}

/**
 * Load a set's snippets (a separate chunk per set).
 *
 * @param id - The set.
 */
export async function loadSnippets(id: SnippetSetId): Promise<readonly Snippet[]> {
  // One literal import per set, so the bundler splits each into its own chunk.
  switch (id) {
    case "javascript":
      return (await import("./javascript")).SNIPPETS;
    case "typescript":
      return (await import("./typescript")).SNIPPETS;
    case "python":
      return (await import("./python")).SNIPPETS;
    case "cpp":
      return (await import("./cpp")).SNIPPETS;
    case "rust":
      return (await import("./rust")).SNIPPETS;
    case "gdscript":
      return (await import("./gdscript")).SNIPPETS;
    case "html":
      return (await import("./html")).SNIPPETS;
    case "css":
      return (await import("./css")).SNIPPETS;
    case "dom":
      return (await import("./dom")).SNIPPETS;
    case "react":
      return (await import("./react")).SNIPPETS;
    case "bun":
      return (await import("./bun")).SNIPPETS;
    case "hono":
      return (await import("./hono")).SNIPPETS;
    case "markdown":
      return (await import("./markdown")).SNIPPETS;
  }
}

/**
 * The snippets matching a filter: every word of `query` must appear (any case)
 * in the title, note, file name, keywords or code. Snippets whose title, note,
 * file or keywords hold every word come first; the rest keep the set's order.
 *
 * @param snippets - A set's snippets.
 * @param query - What the reader typed; blank keeps every snippet.
 */
export function filterSnippets(snippets: readonly Snippet[], query: string): Snippet[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...snippets];
  const about = (s: Snippet) =>
    [s.title, s.note ?? "", s.file ?? "", s.keywords ?? ""].join(" ").toLowerCase();
  const named: Snippet[] = [];
  const inCode: Snippet[] = [];
  for (const snippet of snippets) {
    const meta = about(snippet);
    const all = `${meta} ${snippet.code.toLowerCase()}`;
    if (words.every((w) => meta.includes(w))) named.push(snippet);
    else if (words.every((w) => all.includes(w))) inCode.push(snippet);
  }
  return [...named, ...inCode];
}
