/**
 * @file The playground's project model: files and directories, immutably.
 *
 * A project is a flat map of relative paths to file contents plus the empty
 * directories the user created; the tree is derived. Every operation returns a
 * new project (or an error the UI shows inline) and never mutates its input.
 *
 * Paths are the security boundary for everything downstream (the module
 * linker, the Python filesystem, the CMake file list): only relative paths of
 * `[A-Za-z0-9_.-]` segments, never `.`/`..`, at most {@link PROJECT_LIMITS}.
 * Stored projects are re-validated with the same rules by {@link parseProject}.
 */

import { z } from "zod";

/** Size limits for one project (per language). */
export const PROJECT_LIMITS = {
  /** Most files a project may hold. */
  maxFiles: 60,
  /** Total UTF-8 bytes across all files. */
  maxBytes: 256 * 1024,
  /** Most path segments (`a/b/c.ts` is 3). */
  maxDepth: 5,
  /** Longest single file or directory name. */
  maxSegment: 64,
} as const;

/** A project: files by path, explicit (possibly empty) directories, entry, open file and tabs. */
export interface Project {
  readonly files: Readonly<Record<string, string>>;
  readonly dirs: readonly string[];
  /** The file the runner starts from. */
  readonly entry: string;
  /** The file shown in the editor. */
  readonly open: string;
  /** Files open as tabs, in tab order. */
  readonly tabs: readonly string[];
}

/** The outcome of an operation: the new project, or a message for the user. */
export type ProjectResult = { ok: true; project: Project } | { ok: false; error: string };

/** A node of {@link toTree}. */
export type TreeNode =
  | { kind: "file"; name: string; path: string }
  | { kind: "dir"; name: string; path: string; children: TreeNode[] };

/**
 * Whether `path` is one of the project's files. An own-property check, so names
 * inherited from `Object.prototype` (`constructor`, `toString`, …) are never
 * mistaken for files.
 */
export function hasFile(files: Readonly<Record<string, string>>, path: string): boolean {
  return Object.prototype.hasOwnProperty.call(files, path);
}

/** One allowed file or directory name. */
const SEGMENT = /^[A-Za-z0-9_.-]+$/;

const done = (project: Project): ProjectResult => ({ ok: true, project });
const fail = (error: string): ProjectResult => ({ ok: false, error });

/**
 * Whether `path` is an allowed project path.
 *
 * @param path - A candidate path such as `src/main.rs`.
 * @returns `true` for relative paths of safe segments within the depth limit.
 */
export function isValidPath(path: string): boolean {
  const segments = path.split("/");
  return (
    segments.length <= PROJECT_LIMITS.maxDepth &&
    segments.every(
      (s) => s.length <= PROJECT_LIMITS.maxSegment && SEGMENT.test(s) && s !== "." && s !== "..",
    )
  );
}

/** Parent directory of a path (`""` for top-level). */
export function dirname(path: string): string {
  const i = path.lastIndexOf("/");
  return i === -1 ? "" : path.slice(0, i);
}

/** Last segment of a path. */
export function basename(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

/** Join a directory and a name (`""` is the project root). */
export function joinPath(dir: string, name: string): string {
  return dir ? `${dir}/${name}` : name;
}

/** Every ancestor directory of a path, outermost first (`a/b/c.ts` → `a`, `a/b`). */
function ancestors(path: string): string[] {
  const parts = path.split("/").slice(0, -1);
  return parts.map((_, i) => parts.slice(0, i + 1).join("/"));
}

/** Whether `path` is `dir` itself or inside it. */
const within = (path: string, dir: string) => path === dir || path.startsWith(`${dir}/`);

/** All directories of a project: explicit ones plus every file's ancestors. */
export function allDirs(project: Pick<Project, "files" | "dirs">): Set<string> {
  const dirs = new Set(project.dirs);
  for (const file of Object.keys(project.files)) ancestors(file).forEach((d) => dirs.add(d));
  return dirs;
}

/** Total UTF-8 size of the files. */
function totalBytes(files: Readonly<Record<string, string>>): number {
  const encoder = new TextEncoder();
  return Object.values(files).reduce((sum, text) => sum + encoder.encode(text).length, 0);
}

/** Why `path` can't be created in `project`, or `null` if it can. */
function creationError(project: Project, path: string): string | null {
  if (!isValidPath(path)) {
    return "Use letters, digits, '.', '-' and '_' (no spaces, no '..', at most 5 levels).";
  }
  if (hasFile(project.files, path) || allDirs(project).has(path))
    return `"${path}" already exists.`;
  if (ancestors(path).some((a) => hasFile(project.files, a)))
    return "A file can't contain other files.";
  return null;
}

/** Check the file-count and size limits for a candidate set of files. */
function limitError(files: Readonly<Record<string, string>>): string | null {
  if (Object.keys(files).length > PROJECT_LIMITS.maxFiles) {
    return `A project holds at most ${PROJECT_LIMITS.maxFiles} files.`;
  }
  if (totalBytes(files) > PROJECT_LIMITS.maxBytes) {
    return `A project holds at most ${PROJECT_LIMITS.maxBytes / 1024} KB of code.`;
  }
  return null;
}

/** `tabs` with `path` appended if missing. */
const withTab = (tabs: readonly string[], path: string) =>
  tabs.includes(path) ? tabs : [...tabs, path];

/**
 * Add a file and open it.
 *
 * @param project - The current project.
 * @param path - The new file's path.
 * @param contents - Initial contents.
 * @returns The new project, or why the file can't be added.
 */
export function addFile(project: Project, path: string, contents = ""): ProjectResult {
  const error = creationError(project, path);
  if (error) return fail(error);
  const files = { ...project.files, [path]: contents };
  const limit = limitError(files);
  if (limit) return fail(limit);
  return done({ ...project, files, open: path, tabs: withTab(project.tabs, path) });
}

/**
 * Add an empty directory.
 *
 * @returns The new project, or why the directory can't be added.
 */
export function addDir(project: Project, path: string): ProjectResult {
  const error = creationError(project, path);
  if (error) return fail(error);
  return done({ ...project, dirs: [...project.dirs, path] });
}

/**
 * Replace one file's contents.
 *
 * @returns The new project, or an error for unknown files or when over the size limit.
 */
export function updateFile(project: Project, path: string, contents: string): ProjectResult {
  if (!hasFile(project.files, path)) return fail(`"${path}" doesn't exist.`);
  const files = { ...project.files, [path]: contents };
  const limit = limitError(files);
  if (limit) return fail(limit);
  return done({ ...project, files });
}

/** Map a path under `from` to the same place under `to`. */
const move = (path: string, from: string, to: string) =>
  within(path, from) ? to + path.slice(from.length) : path;

/**
 * Rename (or move) a file or a directory with everything in it. The entry,
 * open file and tabs follow.
 *
 * @returns The new project, or why the rename isn't allowed.
 */
export function rename(project: Project, from: string, to: string): ProjectResult {
  const isFile = hasFile(project.files, from);
  const isDir = !isFile && allDirs(project).has(from);
  if (!isFile && !isDir) return fail(`"${from}" doesn't exist.`);
  if (from === to) return done(project);
  if (isDir && within(to, from)) return fail("A folder can't move into itself.");
  const error = creationError(project, to);
  if (error) return fail(error);
  const files = Object.fromEntries(
    Object.entries(project.files).map(([p, text]) => [move(p, from, to), text]),
  );
  const dirs = project.dirs.map((d) => move(d, from, to));
  return done({
    files,
    dirs,
    entry: move(project.entry, from, to),
    open: move(project.open, from, to),
    tabs: project.tabs.map((t) => move(t, from, to)),
  });
}

/**
 * Remove a file, or a directory and everything in it. The entry file (and any
 * directory holding it) can't be removed; set another entry first.
 *
 * @returns The new project, or why the removal isn't allowed.
 */
export function remove(project: Project, path: string): ProjectResult {
  const exists = hasFile(project.files, path) || allDirs(project).has(path);
  if (!exists) return fail(`"${path}" doesn't exist.`);
  if (within(project.entry, path))
    return fail("That holds the entry file. Set another entry file first.");
  const files = Object.fromEntries(Object.entries(project.files).filter(([p]) => !within(p, path)));
  const dirs = project.dirs.filter((d) => !within(d, path));
  const tabs = project.tabs.filter((t) => !within(t, path));
  const open = within(project.open, path) ? project.entry : project.open;
  return done({ ...project, files, dirs, tabs: withTab(tabs, open), open });
}

/**
 * Make `path` the entry file.
 *
 * @returns The new project, or an error when the file doesn't exist.
 */
export function setEntry(project: Project, path: string): ProjectResult {
  if (!hasFile(project.files, path)) return fail(`"${path}" doesn't exist.`);
  return done({ ...project, entry: path });
}

/**
 * Show `path` in the editor, adding a tab for it.
 *
 * @returns The new project, or an error when the file doesn't exist.
 */
export function setOpen(project: Project, path: string): ProjectResult {
  if (!hasFile(project.files, path)) return fail(`"${path}" doesn't exist.`);
  return done({ ...project, open: path, tabs: withTab(project.tabs, path) });
}

/**
 * Close a tab. Closing the open file switches to its neighbour, or to the
 * entry when no tabs are left.
 */
export function closeTab(project: Project, path: string): Project {
  const index = project.tabs.indexOf(path);
  if (index === -1) return project;
  const tabs = project.tabs.filter((t) => t !== path);
  if (project.open !== path) return { ...project, tabs };
  const open = tabs[Math.min(index, tabs.length - 1)] ?? project.entry;
  return { ...project, tabs: withTab(tabs, open), open };
}

/** Sort directories first, then files, by name. */
function byKindThenName(a: TreeNode, b: TreeNode): number {
  if (a.kind !== b.kind) return a.kind === "dir" ? -1 : 1;
  return a.name.localeCompare(b.name);
}

/**
 * The project as a tree for display.
 *
 * @returns Top-level nodes; directories first, then files, alphabetically.
 */
export function toTree(project: Pick<Project, "files" | "dirs">): TreeNode[] {
  const dirs = [...allDirs(project)];
  const build = (parent: string): TreeNode[] => {
    const childDirs: TreeNode[] = dirs
      .filter((d) => dirname(d) === parent)
      .map((d) => ({ kind: "dir", name: basename(d), path: d, children: build(d) }));
    const childFiles: TreeNode[] = Object.keys(project.files)
      .filter((f) => dirname(f) === parent)
      .map((f) => ({ kind: "file", name: basename(f), path: f }));
    return [...childDirs, ...childFiles].sort(byKindThenName);
  };
  return build("");
}

/** Zod schema for a stored project (paths, limits and entry checked). */
const projectSchema = z
  .object({
    files: z.record(z.string().refine(isValidPath), z.string()),
    dirs: z.array(z.string().refine(isValidPath)).max(PROJECT_LIMITS.maxFiles),
    entry: z.string(),
    open: z.string(),
    tabs: z.array(z.string()).max(PROJECT_LIMITS.maxFiles),
  })
  .refine((p) => hasFile(p.files, p.entry), "entry file missing")
  .refine((p) => limitError(p.files) === null, "over the project limits");

/**
 * Validate an untrusted value (from `localStorage`) as a project. A missing
 * open file or stale tabs are repaired rather than rejected.
 *
 * @param value - Parsed JSON of unknown shape.
 * @returns The project, or `null` when it is invalid.
 */
export function parseProject(value: unknown): Project | null {
  const parsed = projectSchema.safeParse(value);
  if (!parsed.success) return null;
  const project = parsed.data;
  const tabs = project.tabs.filter(
    (t, i) => hasFile(project.files, t) && project.tabs.indexOf(t) === i,
  );
  const open = hasFile(project.files, project.open) ? project.open : project.entry;
  return { ...project, tabs: withTab(tabs, open), open };
}
