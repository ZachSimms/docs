/**
 * @file The playground's languages: how each runs, its starter project, the
 * reference sheets it suggests, and which editor mode each file extension uses.
 *
 * Pure data and helpers; safe on the server and in tests.
 */

import type { Project } from "./project";
import { TEMPLATES } from "./templates";

/** Every playground language. */
export const LANGUAGE_IDS = [
  "javascript",
  "typescript",
  "web",
  "python",
  "cpp",
  "rust",
  "gdscript",
] as const;

/** One playground language. */
export type LanguageId = (typeof LANGUAGE_IDS)[number];

/**
 * Where a language runs:
 * - `script`: a worker inside the sandboxed runner frame (JS, TS);
 * - `web`: the sandboxed live preview;
 * - `python`: Pyodide in a worker inside the runner frame;
 * - `cpp` / `rust`: Compiler Explorer (with a fallback service);
 * - `godot`: the self-hosted Godot web build in a sandboxed frame.
 */
export type RunnerKind = "script" | "web" | "python" | "cpp" | "rust" | "godot";

/** A reference sheet suggested for a language. */
export interface SheetRef {
  readonly href: string;
  readonly label: string;
}

/** Everything the UI needs to know about one language. */
export interface LanguageSpec {
  readonly id: LanguageId;
  readonly label: string;
  readonly runner: RunnerKind;
  /** Whether the program reads the stdin box. */
  readonly stdin: boolean;
  /** What the stdin box holds until the reader types something (matches the starter). */
  readonly stdinExample?: string;
  /** One line under the console: where the code runs (and who sees it). */
  readonly credit: string;
  /** A one-off download the first run needs, if any (the UI asks first). */
  readonly download?: { readonly what: string; readonly megabytes: number };
  /** Starter project. */
  readonly template: Project;
  /** Sheets suggested when the reference panel's search is empty. */
  readonly refs: readonly SheetRef[];
}

/** Code sent to Compiler Explorer is kept in its logs for this many days. */
export const COMPILER_EXPLORER_LOG_DAYS = 32;

const REMOTE_CREDIT = `Compiled on Compiler Explorer (godbolt.org): your code is sent there and logged for ${COMPILER_EXPLORER_LOG_DAYS} days.`;

/** The languages in menu order. */
export const LANGUAGES: readonly LanguageSpec[] = [
  {
    id: "typescript",
    label: "TypeScript",
    runner: "script",
    stdin: false,
    credit: "Runs in your browser (types are stripped, not checked).",
    template: TEMPLATES.typescript,
    refs: [
      { href: "/typescript/language/fundamentals/", label: "typescript/language/fundamentals" },
      {
        href: "/typescript/design-architecture/modules-packages/",
        label: "typescript/design-architecture/modules-packages",
      },
      { href: "/typescript/language/array-methods/", label: "typescript/language/array-methods" },
      { href: "/typescript/language/async-promises/", label: "typescript/language/async-promises" },
    ],
  },
  {
    id: "javascript",
    label: "JavaScript",
    runner: "script",
    stdin: false,
    credit: "Runs in your browser, in a sandbox.",
    template: TEMPLATES.javascript,
    refs: [
      { href: "/typescript/language/fundamentals/", label: "typescript/language/fundamentals" },
      { href: "/typescript/language/objects/", label: "typescript/language/objects" },
      {
        href: "/typescript/design-architecture/modules-packages/",
        label: "typescript/design-architecture/modules-packages",
      },
      { href: "/typescript/language/string-methods/", label: "typescript/language/string-methods" },
    ],
  },
  {
    id: "web",
    label: "HTML/CSS/JS",
    runner: "web",
    stdin: false,
    credit: "Live preview in a sandbox; console output shows below.",
    template: TEMPLATES.web,
    refs: [
      { href: "/design/css/css/", label: "design/css/css" },
      { href: "/design/css/tailwind/", label: "design/css/tailwind" },
      { href: "/typescript/frontend/dom/", label: "typescript/frontend/dom" },
      { href: "/typescript/frontend/events/", label: "typescript/frontend/events" },
    ],
  },
  {
    id: "python",
    label: "Python",
    runner: "python",
    stdin: true,
    stdinExample: "world",
    credit: "Runs in your browser with Pyodide (CPython on WebAssembly).",
    download: { what: "the Python runtime", megabytes: 6 },
    template: TEMPLATES.python,
    refs: [
      { href: "/python/language/fundamentals/", label: "python/language/fundamentals" },
      { href: "/python/engineering/packages/", label: "python/engineering/packages" },
      { href: "/python/language/std-library/", label: "python/language/std-library" },
      { href: "/python/data/numpy/", label: "python/data/numpy" },
    ],
  },
  {
    id: "cpp",
    label: "C++",
    runner: "cpp",
    stdin: true,
    stdinExample: "21",
    credit: REMOTE_CREDIT,
    template: TEMPLATES.cpp,
    refs: [{ href: "/cpp/fundamentals/", label: "cpp/fundamentals" }],
  },
  {
    id: "rust",
    label: "Rust",
    runner: "rust",
    stdin: true,
    stdinExample: "hello from stdin",
    credit: REMOTE_CREDIT,
    template: TEMPLATES.rust,
    refs: [{ href: "/typescript/webassembly/rust/", label: "typescript/webassembly/rust" }],
  },
  {
    id: "gdscript",
    label: "GDScript",
    runner: "godot",
    stdin: false,
    credit: "Runs in your browser on a Godot 4 web build.",
    download: { what: "the Godot engine", megabytes: 10 },
    template: TEMPLATES.gdscript,
    refs: [
      { href: "/game-dev/godot/gdscript/", label: "game-dev/godot/gdscript" },
      { href: "/game-dev/godot/nodes-scenes/", label: "game-dev/godot/nodes-scenes" },
    ],
  },
];

/** The language shown on a first visit. */
export const DEFAULT_LANGUAGE: LanguageId = "typescript";

/** Type guard for {@link LanguageId}. */
export function isLanguageId(value: unknown): value is LanguageId {
  return typeof value === "string" && (LANGUAGE_IDS as readonly string[]).includes(value);
}

/**
 * Look a language up.
 *
 * @throws {Error} For an id that isn't in {@link LANGUAGES} (a programming error).
 */
export function getLanguage(id: LanguageId): LanguageSpec {
  const spec = LANGUAGES.find((l) => l.id === id);
  if (!spec) throw new Error(`Unknown playground language: ${id}`);
  return spec;
}

/** CodeMirror modes the editor can load. */
export type EditorMode =
  | "javascript"
  | "jsx"
  | "typescript"
  | "tsx"
  | "html"
  | "css"
  | "python"
  | "cpp"
  | "rust"
  | "gdscript"
  | "text";

/** File extension → editor mode. */
const MODES: Readonly<Record<string, EditorMode>> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  mts: "typescript",
  tsx: "tsx",
  html: "html",
  htm: "html",
  svg: "html",
  css: "css",
  py: "python",
  c: "cpp",
  cc: "cpp",
  cpp: "cpp",
  cxx: "cpp",
  h: "cpp",
  hh: "cpp",
  hpp: "cpp",
  rs: "rust",
  gd: "gdscript",
};

/**
 * The editor mode for a file.
 *
 * @param path - A project path such as `src/vec.cpp`.
 * @returns The mode for its extension, or `"text"`.
 */
export function modeForPath(path: string): EditorMode {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
  return MODES[ext] ?? "text";
}
