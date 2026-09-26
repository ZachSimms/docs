/**
 * @file The playground's keyboard shortcuts and tour steps, shared by the help
 * panel, the tour and the key handlers.
 */

import type { KeyLike } from "@/lib/keys";

/** One row of the shortcuts table. */
export interface Shortcut {
  readonly keys: string;
  readonly does: string;
}

/** Every playground shortcut, as shown in the help panel. */
export const PLAYGROUND_SHORTCUTS: readonly Shortcut[] = [
  { keys: "⌘↵ / Ctrl+↵", does: "Run the project" },
  { keys: "⌘K / Ctrl+K", does: "Search sheets and docs; results open in the Refs panel" },
  { keys: "⌘⌥Z / Ctrl+Alt+Z", does: "Zen mode: only the code, output and Refs" },
  { keys: "Esc", does: "Leave zen mode (outside the editor)" },
  { keys: "F1 / ⌘/ / Ctrl+/", does: "This help" },
  {
    keys: "Right-click, Shift+F10",
    does: "File menu: rename, delete, set as entry, new file or folder",
  },
  { keys: "F2 / Del", does: "Rename / delete the file selected in the tree" },
  { keys: "↑ ↓ ← →", does: "Move and fold in the file tree" },
  { keys: "Tab", does: "Indent in the editor; press Esc first to move focus out of it" },
  {
    keys: "Drag or ←/→ ↑/↓",
    does: "Resize any pane from its edge (Shift for bigger steps, Enter to reset)",
  },
];

/** A keydown lookalike with the fields the matchers read. */
type KeyEventLike = Pick<KeyLike, "key" | "metaKey" | "ctrlKey" | "altKey"> & {
  code?: string;
  shiftKey?: boolean;
};

/**
 * ⌘⌥Z / Ctrl+Alt+Z. Matched on `code`, because Alt changes `key` on macOS (⌥Z types Ω).
 */
export function isZenShortcut(event: KeyEventLike): boolean {
  return (
    (event.metaKey || event.ctrlKey) &&
    event.altKey &&
    (event.code === "KeyZ" || event.key.toLowerCase() === "z")
  );
}

/** F1, or ⌘/ / Ctrl+/. */
export function isHelpShortcut(event: KeyEventLike): boolean {
  return (
    event.key === "F1" || ((event.metaKey || event.ctrlKey) && !event.altKey && event.key === "/")
  );
}

/** One step of the getting-started tour. */
export interface TourStep {
  readonly id: string;
  /** CSS selector of the element the step points at (`[data-tour="…"]`). */
  readonly target: string;
  /** The phone pane that shows the target. */
  readonly pane: "code" | "files" | "output" | "refs";
  readonly title: string;
  readonly body: string;
}

/** The tour, in order. */
export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: "project",
    target: '[data-tour="project"]',
    pane: "code",
    title: "Pick a project",
    body: "Each project type starts with a small multi-file example. Your changes are saved in this browser, one project per type.",
  },
  {
    id: "files",
    target: '[data-tour="files"]',
    pane: "files",
    title: "Files and folders",
    body: "Right-click a file (or use ⋯) to rename, delete, add files or folders, or make it the entry file (▶) that runs first.",
  },
  {
    id: "editor",
    target: '[data-tour="editor"]',
    pane: "code",
    title: "Write code",
    body: "Hover a name for its type and docs. Imports between your files work like in a real project.",
  },
  {
    id: "run",
    target: '[data-tour="run"]',
    pane: "code",
    title: "Run it",
    body: "Press Run or ⌘↵. Code runs in a sandbox in your browser (C++ and Rust compile on Compiler Explorer).",
  },
  {
    id: "output",
    target: '[data-tour="output"]',
    pane: "output",
    title: "See the output",
    body: "Printed output and errors show here. Programs that read input take it from the stdin box.",
  },
  {
    id: "refs",
    target: '[data-tour="refs"]',
    pane: "refs",
    title: "Look things up",
    body: "Refs searches these cheatsheets and the official docs (MDN, Python, cppreference, …) and shows them beside your code. ⌘K opens it from anywhere.",
  },
  {
    id: "zen",
    target: '[data-tour="help"]',
    pane: "code",
    title: "Zen mode and help",
    body: "⌘⌥Z hides everything but the code, output and Refs. Every pane can be resized from its edge. Help (F1) lists every shortcut.",
  },
];
