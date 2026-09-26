/**
 * @file Pure helpers for running Node projects (Next.js) in a WebContainer on `/playground/node/`.
 *
 * WebContainer (StackBlitz) runs Node in the browser. User code runs on
 * StackBlitz's origin (`*.webcontainer-api.io`), never the site's; the page
 * only sends it the project's files. It needs a cross-origin-isolated page
 * (COOP `same-origin`, COEP `credentialless`), which only that route gets.
 */

import { stripAnsi } from "./output";
import type { Project } from "./project";

/** Where the Node route lives (entered with a full page load: the isolation headers apply per document). */
export const NODE_ROUTE = "/playground/node/";

/** WebContainer's file tree shape (a subset of `FileSystemTree` from `@webcontainer/api`). */
export interface FileTree {
  [name: string]: { file: { contents: string } } | { directory: FileTree };
}

/** The project's files as a nested tree for `mount()`. */
export function toFileTree(files: Readonly<Record<string, string>>): FileTree {
  const root: FileTree = {};
  for (const [path, contents] of Object.entries(files)) {
    const parts = path.split("/").filter(Boolean);
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      const node = (dir[part] ??= { directory: {} });
      if (!("directory" in node)) throw new Error(`${part} is both a file and a folder`);
      dir = node.directory;
    }
    dir[parts.at(-1)!] = { file: { contents } };
  }
  return root;
}

/** What to write and delete to bring the container's copy from `before` to `after`. */
export function fileChanges(
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
): { write: [path: string, contents: string][]; remove: string[] } {
  return {
    write: Object.entries(after).filter(([path, code]) => before[path] !== code),
    remove: Object.keys(before).filter((path) => !(path in after)),
  };
}

/** Whether a change to `package.json` needs `npm install` again (dependencies changed). */
export function needsInstall(before: string | undefined, after: string | undefined): boolean {
  if (before === undefined) return true;
  const deps = (text: string | undefined) => {
    try {
      const json = JSON.parse(text ?? "{}") as Record<string, unknown>;
      return JSON.stringify([json.dependencies ?? {}, json.devDependencies ?? {}]);
    } catch {
      return text;
    }
  };
  return deps(before) !== deps(after);
}

/** A line that is only spinner frames (npm draws braille dots, or \\ | / - without a TTY). */
const SPINNER = /^\s*(?:[\u2800-\u28ff]|[\\|/-])+\s*$/;

/** "Move the cursor to column n": a redraw, like a carriage return. */
const TO_COLUMN = /\u001b\[\d*G/g;

/**
 * Terminal output as console text: no ANSI codes, only the last state of lines
 * redrawn with `\r` or a cursor move (progress bars, spinners), and no spinner-only lines.
 */
export function terminalText(chunk: string): string {
  return stripAnsi(chunk.replace(TO_COLUMN, "\r"))
    .split("\n")
    .map((line) => line.split("\r").filter(Boolean).at(-1) ?? "")
    .filter((line) => !SPINNER.test(line))
    .join("\n");
}

/** Why the WebContainer can't run here, or `null` when it can. */
export type NodeSupport = null | "not-isolated" | "ios";

/**
 * Check support: iOS browsers are all WebKit, which WebContainer doesn't
 * support; elsewhere the page must be cross-origin isolated (Safari and older
 * browsers ignore `COEP: credentialless`).
 */
export function nodeSupport(env: {
  crossOriginIsolated: boolean;
  userAgent: string;
  maxTouchPoints: number;
}): NodeSupport {
  const ios =
    /iPhone|iPad|iPod/.test(env.userAgent) ||
    (/Macintosh/.test(env.userAgent) && env.maxTouchPoints > 1);
  if (ios) return "ios";
  return env.crossOriginIsolated ? null : "not-isolated";
}

/** StackBlitz's "open a project" endpoint (the form the StackBlitz SDK posts). */
export const STACKBLITZ_RUN = "https://stackblitz.com/run";

/**
 * Form fields that open the project on StackBlitz in a new tab, for browsers
 * that can't run it here.
 */
export function stackblitzFields(project: Project, title: string): [name: string, value: string][] {
  return [
    ["project[title]", title],
    ["project[description]", "From the easy-docs playground"],
    ["project[template]", "node"],
    ...Object.entries(project.files).map(([path, contents]): [string, string] => [
      `project[files][${path}]`,
      contents,
    ]),
  ];
}
