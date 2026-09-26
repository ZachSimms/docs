/**
 * @file What basedpyright (Python analysis in the browser) needs to know about a project.
 *
 * Pure. The server is `browser-basedpyright`, copied from the pinned npm
 * package to `public/playground/pyright/` by `scripts/copy-pyright.ts`. It runs
 * in workers on the site's origin, where it only reads and analyzes code.
 */

/** The pinned `browser-basedpyright` version. */
export const PYRIGHT_VERSION = "1.40.1";

/** Where the worker bundle is served. */
export const PYRIGHT_WORKER_URL = `/playground/pyright/${PYRIGHT_VERSION}/pyright.worker.js`;

/** The workspace root in the server's in-memory file system (the bundled typeshed sits under it too). */
export const PYRIGHT_ROOT = "file:///";

/** The Python the playground runs (Pyodide 314). */
export const PYTHON_VERSION = "3.14";

/** `pyrightconfig.json` for the workspace. */
export const PYRIGHT_CONFIG = {
  // The bundle mounts its stubs at /typeshed, not the default typeshed-fallback.
  typeshedPath: "/typeshed",
  // Only the project's own sources; otherwise it analyzes every stub in the file system.
  include: ["**/*.py"],
  pythonVersion: PYTHON_VERSION,
  // basedpyright's default ("recommended") flags missing annotations everywhere: too noisy for practice code.
  typeCheckingMode: "standard",
} as const;

/** The `initialize` request's `initializationOptions` (the server requires `files`). */
export function pyrightInitOptions(): { files: Record<string, string> } {
  return { files: { "/pyrightconfig.json": JSON.stringify(PYRIGHT_CONFIG) } };
}

/** Does basedpyright analyze this file? */
export function isPythonPath(path: string): boolean {
  return /\.pyi?$/.test(path);
}

/** A project path as a document URI in the server's file system. */
export function pythonUri(path: string): string {
  return `${PYRIGHT_ROOT}${path.replace(/^\/+/, "").split("/").map(encodeURIComponent).join("/")}`;
}

/** The project's Python files, by URI. */
export function pythonFiles(files: Readonly<Record<string, string>>): Map<string, string> {
  return new Map(
    Object.entries(files)
      .filter(([path]) => isPythonPath(path))
      .map(([path, code]) => [pythonUri(path), code]),
  );
}

/** An LSP diagnostic (severity 1 error, 2 warning, 3 information, 4 hint). */
interface LspDiagnostic {
  severity?: number;
  /** The check's rule name (`reportAttributeAccessIssue`, …); syntax errors have none. */
  code?: string | number;
}

/**
 * Type errors as warnings (Python never checks types when it runs), but
 * syntax errors, which have no rule name, stay errors: those stop the program.
 */
export function softenDiagnostics<D extends LspDiagnostic>(diagnostics: readonly D[]): D[] {
  return diagnostics.map((d) =>
    d.severity === 1 && d.code !== undefined ? { ...d, severity: 2 } : d,
  );
}
