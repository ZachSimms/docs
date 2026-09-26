/**
 * @file What "Download" in the file menu saves: a file as itself, a folder or the project as a ZIP.
 *
 * Pure (the page turns the result into a Blob and clicks a download link).
 * Everything comes from the project in the page; nothing is uploaded. Paths are
 * the project model's validated relative paths, so archive entries can't point
 * outside the folder they unzip into.
 */

import { allDirs, basename, type Project } from "./project";
import { createZip, type ZipEntry } from "./zip";

/** A file to save: its name, bytes and type. */
export interface Download {
  readonly name: string;
  readonly data: Uint8Array;
  readonly type: string;
}

/** A single file, under its own name. */
export function fileDownload(project: Project, path: string): Download | null {
  const code = project.files[path];
  if (code === undefined) return null;
  return {
    name: basename(path),
    data: new TextEncoder().encode(code),
    type: "application/octet-stream",
  };
}

/**
 * A folder (`dir`) or the whole project (`dir` = `null`) as a ZIP whose top
 * level is one folder: the folder itself, or `<projectName>/` for the project.
 * Empty folders are kept.
 */
export function zipDownload(
  project: Project,
  dir: string | null,
  projectName: string,
  modified = new Date(),
): Download {
  const inside = (path: string) => dir === null || path.startsWith(`${dir}/`);
  // Entry paths start at the folder itself: "src/app.ts" for src/, "<project>/…" for the project.
  const root = dir === null ? `${projectName}/` : `${basename(dir)}/`;
  const relative = (path: string) => root + (dir === null ? path : path.slice(dir.length + 1));
  const entries: ZipEntry[] = [
    { path: root },
    ...[...allDirs(project)]
      .filter((d) => inside(d) && d !== dir)
      .sort()
      .map((d) => ({ path: `${relative(d)}/` })),
    ...Object.keys(project.files)
      .filter(inside)
      .sort()
      .map((path) => ({ path: relative(path), data: project.files[path] })),
  ];
  return {
    name: `${root.slice(0, -1)}.zip`,
    data: createZip(entries, modified),
    type: "application/zip",
  };
}

/** The project archive's folder name: `react-playground`, `python-playground`, … */
export function projectArchiveName(language: string): string {
  return `${language.replace(/[^\w-]+/g, "-")}-playground`;
}
