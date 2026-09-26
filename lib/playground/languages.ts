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
  "web-ts",
  "react",
  "python",
  "bun",
  "hono",
  "cpp",
  "rust",
  "gdscript",
  "markdown",
] as const;

/** One playground language. */
export type LanguageId = (typeof LANGUAGE_IDS)[number];

/**
 * Where a language runs:
 * - `script`: a worker inside the sandboxed runner frame (JS, TS);
 * - `web`: the sandboxed live preview;
 * - `python`: Pyodide in a worker inside the runner frame;
 * - `cpp` / `rust`: Compiler Explorer (with a fallback service);
 * - `godot`: the self-hosted Godot web build in a sandboxed frame;
 * - `bun`: a worker with an emulation of Bun's APIs, driven by the HTTP panel;
 * - `markdown`: nothing runs, the preview renders.
 */
export type RunnerKind =
  "script" | "web" | "python" | "cpp" | "rust" | "godot" | "bun" | "markdown";

/** Groups of the project picker, in order. */
export const LANGUAGE_GROUPS = ["Web", "Scripts", "Servers", "Compiled", "Game", "Notes"] as const;

/** A request preset for the HTTP panel of a server project. */
export interface HttpPreset {
  readonly method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  readonly path: string;
  readonly body?: string;
}

/** A reference sheet suggested for a language. */
export interface SheetRef {
  readonly href: string;
  readonly label: string;
}

/** Everything the UI needs to know about one language. */
export interface LanguageSpec {
  readonly id: LanguageId;
  readonly label: string;
  readonly group: (typeof LANGUAGE_GROUPS)[number];
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
  /** Ready-made requests for the HTTP panel (server projects). */
  readonly httpPresets?: readonly HttpPreset[];
}

/** Code sent to Compiler Explorer is kept in its logs for this many days. */
export const COMPILER_EXPLORER_LOG_DAYS = 32;

const REMOTE_CREDIT = `Compiled on Compiler Explorer (godbolt.org): your code is sent there and logged for ${COMPILER_EXPLORER_LOG_DAYS} days.`;

/** A reference sheet by URL (its label is the path). */
const sheet = (href: string): SheetRef => ({ href, label: href.replace(/^\/|\/$/g, "") });

/** The languages in menu order (grouped by {@link LANGUAGE_GROUPS}). */
export const LANGUAGES: readonly LanguageSpec[] = [
  {
    id: "web",
    label: "HTML/CSS/JS",
    group: "Web",
    runner: "web",
    stdin: false,
    credit: "Live preview in a sandbox; console output shows beside it.",
    template: TEMPLATES.web,
    refs: [
      sheet("/design/html/semantic-elements/"),
      sheet("/design/css/css/"),
      sheet("/design/css/tailwind/"),
      sheet("/typescript/frontend/dom/"),
      sheet("/typescript/frontend/events/"),
    ],
  },
  {
    id: "web-ts",
    label: "HTML/CSS/TS",
    group: "Web",
    runner: "web",
    stdin: false,
    credit: "Live preview in a sandbox; TypeScript is stripped in your browser, not checked.",
    template: TEMPLATES["web-ts"],
    refs: [
      sheet("/typescript/frontend/dom/"),
      sheet("/typescript/language/fundamentals/"),
      sheet("/design/html/semantic-elements/"),
      sheet("/design/css/css/"),
    ],
  },
  {
    id: "react",
    label: "React",
    group: "Web",
    runner: "web",
    stdin: false,
    credit: "Live preview in a sandbox; React and npm packages load from esm.sh.",
    template: TEMPLATES.react,
    refs: [
      sheet("/typescript/react/react/"),
      sheet("/typescript/react/react-hooks/"),
      sheet("/typescript/react/typescript-react/"),
    ],
  },
  {
    id: "typescript",
    label: "TypeScript",
    group: "Scripts",
    runner: "script",
    stdin: false,
    credit: "Runs in your browser (types are stripped, not checked).",
    template: TEMPLATES.typescript,
    refs: [
      sheet("/typescript/language/fundamentals/"),
      sheet("/typescript/design-architecture/modules-packages/"),
      sheet("/typescript/language/array-methods/"),
      sheet("/typescript/language/async-promises/"),
    ],
  },
  {
    id: "javascript",
    label: "JavaScript",
    group: "Scripts",
    runner: "script",
    stdin: false,
    credit: "Runs in your browser, in a sandbox.",
    template: TEMPLATES.javascript,
    refs: [
      sheet("/typescript/language/fundamentals/"),
      sheet("/typescript/language/objects/"),
      sheet("/typescript/design-architecture/modules-packages/"),
      sheet("/typescript/language/string-methods/"),
    ],
  },
  {
    id: "python",
    label: "Python",
    group: "Scripts",
    runner: "python",
    stdin: true,
    stdinExample: "world",
    credit:
      "Runs in your browser with Pyodide (CPython on WebAssembly). Hovers and checks: basedpyright (experimental).",
    download: { what: "the Python runtime", megabytes: 6 },
    template: TEMPLATES.python,
    refs: [
      sheet("/python/language/fundamentals/"),
      sheet("/python/engineering/packages/"),
      sheet("/python/language/std-library/"),
      sheet("/python/data/numpy/"),
    ],
  },
  {
    id: "bun",
    label: "Bun",
    group: "Servers",
    runner: "bun",
    stdin: false,
    credit: "Bun APIs emulated in your browser; not real Bun. Send requests from the HTTP panel.",
    template: TEMPLATES.bun,
    refs: [sheet("/typescript/runtime-tooling/bun/"), sheet("/typescript/web-apis/fetch-api/")],
    httpPresets: [
      { method: "GET", path: "/" },
      { method: "GET", path: "/time" },
      { method: "POST", path: "/echo", body: '{ "hello": "bun" }' },
    ],
  },
  {
    id: "hono",
    label: "Bun + Hono",
    group: "Servers",
    runner: "bun",
    stdin: false,
    credit: "Real Hono on Bun APIs emulated in your browser. Send requests from the HTTP panel.",
    template: TEMPLATES.hono,
    refs: [sheet("/typescript/backend/hono/"), sheet("/typescript/runtime-tooling/bun/")],
    httpPresets: [
      { method: "GET", path: "/" },
      { method: "GET", path: "/users" },
      { method: "GET", path: "/users/1" },
      { method: "POST", path: "/users", body: '{ "name": "Grace" }' },
    ],
  },
  {
    id: "cpp",
    label: "C++",
    group: "Compiled",
    runner: "cpp",
    stdin: true,
    stdinExample: "21",
    credit: REMOTE_CREDIT,
    template: TEMPLATES.cpp,
    refs: [sheet("/cpp/fundamentals/")],
  },
  {
    id: "rust",
    label: "Rust",
    group: "Compiled",
    runner: "rust",
    stdin: true,
    stdinExample: "hello from stdin",
    credit: REMOTE_CREDIT,
    template: TEMPLATES.rust,
    refs: [sheet("/typescript/webassembly/rust/")],
  },
  {
    id: "gdscript",
    label: "GDScript",
    group: "Game",
    runner: "godot",
    stdin: false,
    credit: "Runs in your browser on a Godot 4 web build.",
    download: { what: "the Godot engine", megabytes: 10 },
    template: TEMPLATES.gdscript,
    refs: [
      sheet("/game-dev/godot/gdscript/"),
      sheet("/game-dev/godot/nodes-scenes/"),
      sheet("/game-dev/design/open-world/"),
    ],
  },
  {
    id: "markdown",
    label: "Markdown",
    group: "Notes",
    runner: "markdown",
    stdin: false,
    credit: "Nothing runs: the preview renders your Markdown (raw HTML is shown as text).",
    template: TEMPLATES.markdown,
    refs: [
      sheet("/writing/nonfiction/technical-writing/"),
      sheet("/writing/nonfiction/clear-writing/"),
      sheet("/design/overview/"),
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
  | "markdown"
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
  md: "markdown",
  markdown: "markdown",
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
