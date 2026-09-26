/**
 * @file The code that runs *inside* the sandbox: the runner frame's script,
 * the JS worker and the Python (Pyodide) worker.
 *
 * None of this runs on the site's origin. {@link buildRunnerSrcDoc} serialises
 * these functions with `toString()` into the `srcdoc` of an
 * `<iframe sandbox="allow-scripts">` (an opaque origin with no access to the
 * site's storage, cookies or DOM). The frame starts a Worker from a URL it
 * creates itself, so user code runs off the page's main thread and can be
 * killed. Because they are serialised, each function must be self-contained:
 * it may only use its parameters and browser globals.
 */

import { formatConsoleArgs } from "./format";

/** The worker-side view of a worker global scope (a subset, so tests can fake it). */
export interface WorkerLike {
  postMessage(message: unknown): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  addEventListener(
    type: "unhandledrejection",
    listener: (event: { reason: unknown }) => void,
  ): void;
  importScripts?(...urls: string[]): void;
}

/**
 * JS worker: imports the linked entry module with `console` redirected to the
 * page. Reports `done` once the module's top level has finished; output from
 * timers after that still arrives until the next run replaces the worker.
 *
 * @param scope - The worker's global scope (`self`).
 * @param format - {@link formatConsoleArgs}, passed in because it is serialised separately.
 * @param load - How to import the entry (`(url) => import(url)` in the worker; a fake in tests).
 */
export function jsWorkerMain(
  scope: WorkerLike,
  format: (args: readonly unknown[]) => string,
  load: (url: string) => Promise<unknown>,
): void {
  const post = (stream: string, text: string) => scope.postMessage({ type: "out", stream, text });
  const describe = (error: unknown) =>
    error instanceof Error
      ? error.stack || `${error.name}: ${error.message}`
      : `Uncaught ${format([error])}`;
  const methods: [string, string][] = [
    ["log", "stdout"],
    ["info", "stdout"],
    ["debug", "stdout"],
    ["dir", "stdout"],
    ["table", "stdout"],
    ["warn", "stderr"],
    ["error", "stderr"],
    ["trace", "stderr"],
  ];
  const sink = console as unknown as Record<string, (...args: unknown[]) => void>;
  for (const [method, stream] of methods) {
    sink[method] = (...args: unknown[]) => post(stream, `${format(args)}\n`);
  }
  scope.addEventListener("unhandledrejection", (event) =>
    post("stderr", `Uncaught (in promise) ${describe(event.reason)}\n`),
  );
  scope.onmessage = async (event) => {
    const { entryUrl } = event.data as { entryUrl: string };
    try {
      await load(entryUrl);
      scope.postMessage({ type: "done", exitCode: 0 });
    } catch (error) {
      post("stderr", `${describe(error)}\n`);
      scope.postMessage({ type: "done", exitCode: 1 });
    }
  };
}

/** What the Python worker receives per run. */
export interface PythonJob {
  files: Record<string, string>;
  entry: string;
  stdin: string;
  indexUrl: string;
}

/** The subset of the Pyodide API the worker uses. */
export interface PyodideLike {
  FS: { mkdirTree(path: string): void; writeFile(path: string, data: string): void };
  setStdout(options: { write(buffer: Uint8Array): number }): void;
  setStderr(options: { write(buffer: Uint8Array): number }): void;
  setStdin(options: { stdin(): string | null }): void;
  loadPackagesFromImports(
    code: string,
    options?: { messageCallback?(message: string): void },
  ): Promise<unknown>;
  runPythonAsync(code: string, options?: { globals?: unknown }): Promise<unknown>;
  globals: { get(name: string): unknown };
  toPy(value: unknown): unknown;
}

/**
 * Python worker: loads Pyodide once, then for each run writes the project to
 * `/home/pyodide/project`, installs packages its imports need, feeds stdin
 * line by line, and runs the entry as `__main__` (fresh project modules each
 * run). `SystemExit` sets the exit code.
 *
 * @param scope - The worker's global scope.
 * @param boot - Loads Pyodide (imports `pyodide.mjs` and calls `loadPyodide` in the worker; a fake in tests).
 */
export function pythonWorkerMain(
  scope: WorkerLike,
  boot: (indexUrl: string) => Promise<PyodideLike>,
): void {
  const ROOT = "/home/pyodide/project";
  let pyodide: Promise<PyodideLike> | null = null;
  const decoder = new TextDecoder();
  const post = (stream: string, text: string) => scope.postMessage({ type: "out", stream, text });
  const writer = (stream: string) => ({
    write(buffer: Uint8Array) {
      post(stream, decoder.decode(buffer));
      return buffer.length;
    },
  });
  const RUN = `
import os, runpy, shutil, sys
root, entry = __playground_root, __playground_entry
code = 0
os.chdir(root)
if root not in sys.path:
    sys.path.insert(0, root)
for name, mod in list(sys.modules.items()):
    if (getattr(mod, "__file__", None) or "").startswith(root + "/"):
        del sys.modules[name]
try:
    runpy.run_path(entry, run_name="__main__")
except SystemExit as exit:
    code = exit.code if isinstance(exit.code, int) else (0 if exit.code is None else 1)
    if not isinstance(exit.code, (int, type(None))):
        print(exit.code, file=sys.stderr)
code
`;

  scope.onmessage = async (event) => {
    const job = event.data as PythonJob;
    try {
      if (!pyodide) {
        post("info", "Loading Python…\n");
        // A failed boot (a network blip) isn't remembered: the next run tries again.
        pyodide = boot(job.indexUrl).catch((error: unknown) => {
          pyodide = null;
          throw error;
        });
      }
      const py = await pyodide;
      py.setStdout(writer("stdout"));
      py.setStderr(writer("stderr"));
      const lines = job.stdin.split("\n");
      let next = 0;
      py.setStdin({ stdin: () => (next < lines.length ? (lines[next++] ?? "") : null) });

      await py.runPythonAsync(
        `import shutil; shutil.rmtree(${JSON.stringify(ROOT)}, ignore_errors=True)`,
      );
      for (const [path, contents] of Object.entries(job.files)) {
        const full = `${ROOT}/${path}`;
        py.FS.mkdirTree(full.slice(0, full.lastIndexOf("/")));
        py.FS.writeFile(full, contents);
      }
      const sources = Object.entries(job.files)
        .filter(([path]) => path.endsWith(".py"))
        .map(([, text]) => text)
        .join("\n");
      await py.loadPackagesFromImports(sources, { messageCallback: (m) => post("info", `${m}\n`) });

      const globals = py.toPy({
        __playground_root: ROOT,
        __playground_entry: `${ROOT}/${job.entry}`,
      });
      // The page starts the run's time limit here, after the runtime and packages have loaded.
      scope.postMessage({ type: "progress", text: "running" });
      const exitCode = await py.runPythonAsync(RUN, { globals });
      scope.postMessage({ type: "done", exitCode: typeof exitCode === "number" ? exitCode : 0 });
    } catch (error) {
      post("stderr", `${error instanceof Error ? error.message : String(error)}\n`);
      scope.postMessage({ type: "done", exitCode: 1 });
    }
  };
}

/** Sources the runner frame turns into workers. */
export interface WorkerSources {
  js: string;
  python: string;
}

/**
 * The runner frame's script: relays work from the page to a worker and the
 * worker's messages back, tagged with the current run's token. It only obeys
 * messages from its parent. If the browser refuses to start a worker here, JS
 * runs on the frame's own thread instead (the page then stops it by
 * reloading the frame).
 *
 * @param sources - Worker source code, keyed by kind.
 */
export function runnerFrameMain(sources: WorkerSources): void {
  let worker: Worker | null = null;
  let workerKind: string | null = null;
  let token: string | null = null;

  const toParent = (message: Record<string, unknown>) =>
    parent.postMessage({ ...message, token }, "*");

  const spawn = (kind: "js" | "python"): Worker | null => {
    try {
      // At an opaque origin Chromium refuses module workers from blob: URLs. JS runs in a
      // classic blob: worker (it can still import() the linked data: modules); Pyodide
      // insists on a module worker, which works from a data: URL.
      const w =
        kind === "js"
          ? new Worker(URL.createObjectURL(new Blob([sources.js], { type: "text/javascript" })))
          : new Worker(`data:text/javascript,${encodeURIComponent(sources.python)}`, {
              type: "module",
            });
      w.onmessage = (event: MessageEvent) => toParent(event.data as Record<string, unknown>);
      w.onerror = (event: ErrorEvent) => {
        event.preventDefault();
        toParent({ type: "out", stream: "stderr", text: `${event.message}\n` });
        toParent({ type: "done", exitCode: 1 });
      };
      return w;
    } catch {
      return null;
    }
  };

  /** Main-thread fallback for JS when workers are unavailable. */
  const runHere = (entryUrl: string) => {
    const methods = ["log", "info", "debug", "warn", "error"] as const;
    const sink = console as unknown as Record<string, (...args: unknown[]) => void>;
    for (const m of methods) {
      sink[m] = (...args: unknown[]) =>
        toParent({
          type: "out",
          stream: m === "warn" || m === "error" ? "stderr" : "stdout",
          text: `${args.map(String).join(" ")}\n`,
        });
    }
    // Built at runtime so the bundler doesn't rewrite this import() when compiling the page.
    const dynamicImport = new Function("url", "return import(url)") as (
      url: string,
    ) => Promise<unknown>;
    dynamicImport(entryUrl).then(
      () => toParent({ type: "done", exitCode: 0 }),
      (error: unknown) => {
        toParent({
          type: "out",
          stream: "stderr",
          text: `${error instanceof Error ? error.stack : String(error)}\n`,
        });
        toParent({ type: "done", exitCode: 1 });
      },
    );
  };

  addEventListener("message", (event: MessageEvent) => {
    if (event.source !== parent) return;
    const command = event.data as {
      type?: string;
      kind?: string;
      token?: string;
      entryUrl?: string;
    };
    if (command.type !== "run" || typeof command.token !== "string") return;
    token = command.token;
    const kind = command.kind === "python" ? "python" : "js";
    if (kind === "js" || workerKind !== kind) {
      worker?.terminate();
      worker = spawn(kind);
      workerKind = worker ? kind : null;
    }
    if (!worker) {
      if (kind === "js" && command.entryUrl) runHere(command.entryUrl);
      else {
        toParent({
          type: "out",
          stream: "stderr",
          text: "This browser can't start a worker for the runner.\n",
        });
        toParent({ type: "done", exitCode: null });
      }
      return;
    }
    const envelope = new Set(["type", "token", "kind"]);
    worker.postMessage(
      Object.fromEntries(Object.entries(command).filter(([key]) => !envelope.has(key))),
    );
  });

  parent.postMessage({ type: "ready" }, "*");
}

/** Escape `</script` so serialised code can't close the frame's script element. */
const safeScript = (code: string) => code.replace(/<\/(script)/gi, "<\\/$1");

/**
 * The runner frame's document.
 *
 * @returns `srcdoc` HTML for an `<iframe sandbox="allow-scripts">`.
 */
export function buildRunnerSrcDoc(): string {
  const js = `const formatConsoleArgs = ${formatConsoleArgs.toString()};
(${jsWorkerMain.toString()})(self, formatConsoleArgs, (url) => import(url));`;
  const python = `(${pythonWorkerMain.toString()})(self, (indexUrl) =>
  import(indexUrl + "pyodide.mjs").then((m) => m.loadPyodide({ indexURL: indexUrl })));`;
  const sources: WorkerSources = { js, python };
  const script = `(${runnerFrameMain.toString()})(${JSON.stringify(sources)});`;
  return `<!doctype html><meta charset="utf-8"><title>runner</title><script>${safeScript(script)}</script>`;
}
