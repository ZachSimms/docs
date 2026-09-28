/**
 * @file The editor side of basedpyright: hover, completions, signature help and diagnostics for Python.
 *
 * Client-only. `pythonService` starts the server once per page (lazily, on the
 * first Python file focused). The server is a worker that boots in two
 * halves: the page sends `browser/boot` to the foreground worker, which then
 * asks for background workers (`browser/newWorker`) that get a message port.
 * Every `.py` file of the project is opened in the server, not only the one in
 * the editor, so imports between them resolve. Hover documentation arrives as
 * Markdown, is rendered to HTML by the client, and is sanitized.
 */

"use client";

import type { Text } from "@codemirror/state";
import { Text as TextDoc, type Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  LSPClient,
  LSPPlugin,
  Workspace,
  hoverTooltips,
  serverCompletion,
  serverDiagnostics,
  signatureHelp,
  type Transport,
  type WorkspaceFile,
} from "@codemirror/lsp-client";
import createDOMPurify from "dompurify";
import {
  PYRIGHT_ROOT,
  PYRIGHT_WORKER_URL,
  pyrightInitOptions,
  pythonFiles,
  pythonUri,
  softenDiagnostics,
} from "@/lib/playground/intellisense/pyright-config";

/** Requests can be slow while the first analysis runs. */
const REQUEST_TIMEOUT_MS = 20_000;

/** One project file as the server has it. */
class ProjectFile implements WorkspaceFile {
  readonly languageId = "python";
  constructor(
    readonly uri: string,
    public version: number,
    public doc: Text,
    public view: EditorView | null = null,
  ) {}
  getView(): EditorView | null {
    return this.view;
  }
}

/**
 * All of the project's Python files, open in the server. A file shown in the
 * editor syncs from its view; the others sync from the project on
 * {@link ProjectWorkspace.setProject}.
 */
export class ProjectWorkspace extends Workspace {
  files: ProjectFile[] = [];
  /** Initialized: files are opened as they appear (before that, `connected` opens them all). */
  private live = false;

  /** Add a file to the server's file system (it only resolves imports of files there), then open it. */
  private open(file: ProjectFile) {
    this.client.notification("pyright/createFile", { kind: "create", uri: file.uri });
    this.client.didOpen(file);
  }

  /** Send a file's whole new text. */
  private replace(file: ProjectFile, doc: Text) {
    file.doc = doc;
    file.version += 1;
    this.client.notification("textDocument/didChange", {
      textDocument: { uri: file.uri, version: file.version },
      contentChanges: [{ text: doc.toString() }],
    });
  }

  /** Mirror the project: open new files, update changed ones not in the editor, close deleted ones. */
  setProject(project: Readonly<Record<string, string>>) {
    const wanted = pythonFiles(project);
    for (const file of this.files) {
      if (wanted.has(file.uri) || !this.live) continue;
      this.client.didClose(file.uri);
      this.client.notification("pyright/deleteFile", { kind: "delete", uri: file.uri });
    }
    this.files = this.files.filter((f) => wanted.has(f.uri));
    for (const [uri, code] of wanted) {
      const file = this.getFile(uri) as ProjectFile | null;
      if (!file) {
        const created = new ProjectFile(uri, 0, TextDoc.of(code.split("\n")));
        this.files.push(created);
        if (this.live) this.open(created);
      } else if (!file.view && file.doc.toString() !== code) {
        if (this.live) this.replace(file, TextDoc.of(code.split("\n")));
        else file.doc = TextDoc.of(code.split("\n"));
      }
    }
  }

  syncFiles() {
    const updates = [];
    for (const file of this.files) {
      const plugin = file.view && LSPPlugin.get(file.view);
      if (!plugin || plugin.unsyncedChanges.empty) continue;
      updates.push({ changes: plugin.unsyncedChanges, file, prevDoc: file.doc });
      file.doc = file.view!.state.doc;
      file.version += 1;
      plugin.clear();
    }
    return updates;
  }

  openFile(uri: string, _languageId: string, view: EditorView) {
    const file = this.getFile(uri) as ProjectFile | null;
    if (!file) {
      const created = new ProjectFile(uri, 0, view.state.doc, view);
      this.files.push(created);
      if (this.live) this.open(created);
      return;
    }
    file.view = view;
    if (file.doc.toString() === view.state.doc.toString()) return;
    if (this.live) this.replace(file, view.state.doc);
    else file.doc = view.state.doc;
  }

  closeFile(uri: string, view: EditorView) {
    // The file stays open in the server (other files may import it); it just has no editor now.
    const file = this.getFile(uri) as ProjectFile | null;
    if (file?.view === view) file.view = null;
  }

  connected() {
    this.live = true;
    for (const file of this.files) this.open(file);
  }

  disconnected() {
    this.live = false;
  }
}

/** The worker speaks JSON-RPC as posted objects; the client speaks strings. */
function workerTransport(worker: Worker): Transport {
  const handlers = new Map<(value: string) => void, (event: MessageEvent) => void>();
  return {
    send(message) {
      const data = JSON.parse(message) as { method?: string; params?: Record<string, unknown> };
      // The client sends only rootUri; the server reads pyrightconfig.json from workspace folders.
      if (data.method === "initialize" && data.params)
        data.params = {
          ...data.params,
          workspaceFolders: [{ uri: PYRIGHT_ROOT, name: "playground" }],
        };
      worker.postMessage(data);
    },
    subscribe(handler) {
      const listener = (event: MessageEvent) => {
        const data = event.data as { jsonrpc?: unknown } | null;
        if (data && typeof data === "object" && data.jsonrpc === "2.0")
          handler(JSON.stringify(data));
      };
      handlers.set(handler, listener);
      worker.addEventListener("message", listener);
    },
    unsubscribe(handler) {
      const listener = handlers.get(handler);
      if (listener) worker.removeEventListener("message", listener);
      handlers.delete(handler);
    },
  };
}

/** Start the foreground worker and give it background workers when it asks. */
function bootWorkers(): { foreground: Worker; stop(): void } {
  const workers: Worker[] = [];
  const foreground = new Worker(PYRIGHT_WORKER_URL, { name: "basedpyright" });
  workers.push(foreground);
  foreground.addEventListener("message", (event: MessageEvent) => {
    const data = event.data as { type?: string; initialData?: unknown; port?: MessagePort } | null;
    if (data?.type !== "browser/newWorker" || !data.port) return;
    const background = new Worker(PYRIGHT_WORKER_URL, { name: `basedpyright-${workers.length}` });
    workers.push(background);
    background.postMessage(
      { type: "browser/boot", mode: "background", initialData: data.initialData, port: data.port },
      [data.port],
    );
  });
  foreground.postMessage({ type: "browser/boot", mode: "foreground" });
  return { foreground, stop: () => workers.forEach((w) => w.terminate()) };
}

/** A started server. */
export interface PythonService {
  readonly client: LSPClient;
  readonly workspace: ProjectWorkspace;
}

let running: { ready: Promise<PythonService>; stop(): void } | null = null;

/** The page's basedpyright, started on first use. */
export function pythonService(): Promise<PythonService> {
  // A failed start is remembered for the page's life, so edits don't reboot the workers again and again.
  if (running) return running.ready;
  let stopWorkers: () => void = () => undefined;
  const ready = (async () => {
    const purify = createDOMPurify(window);
    if (!purify.isSupported) throw new Error("no safe HTML sanitizer here");
    // Download the bundle (~3 MB compressed) before the client's request timeout starts counting.
    const bundle = await fetch(PYRIGHT_WORKER_URL);
    if (!bundle.ok) throw new Error(`basedpyright: HTTP ${bundle.status}`);
    await bundle.arrayBuffer();
    const { foreground, stop } = bootWorkers();
    stopWorkers = stop;
    const client = new LSPClient({
      rootUri: PYRIGHT_ROOT,
      initializationOptions: pyrightInitOptions(),
      workspace: (c) => new ProjectWorkspace(c),
      timeout: REQUEST_TIMEOUT_MS,
      // Included in every file's plugin.
      extensions: [
        hoverTooltips(),
        serverCompletion({ override: true }),
        signatureHelp(),
        serverDiagnostics(),
      ],
      // In the playground's own page: no named elements that could shadow globals, and
      // links to the web only.
      sanitizeHTML: (html) =>
        purify.sanitize(html, {
          FORBID_TAGS: ["style", "form", "img"],
          SANITIZE_NAMED_PROPS: true,
          ALLOWED_URI_REGEXP: /^(?:https:|#)/i,
        }),
      notificationHandlers: {
        "textDocument/publishDiagnostics": (
          _client,
          params: { diagnostics: { severity?: number }[] },
        ) => {
          // Soften in place, then let serverDiagnostics' own handler (tried after this one) show them.
          params.diagnostics = softenDiagnostics(params.diagnostics);
          return false;
        },
        // Progress and baseline chatter the client doesn't know.
        "pyright/beginProgress": () => true,
        "pyright/reportProgress": () => true,
        "pyright/endProgress": () => true,
      },
    });
    await client.connect(workerTransport(foreground)).initializing;
    return { client, workspace: client.workspace as ProjectWorkspace };
  })();
  ready.catch(() => stopWorkers());
  running = { ready, stop: () => stopWorkers() };
  return ready;
}

/** Stop the server (tests, and leaving the page). */
export function stopPythonService(): void {
  running?.stop();
  running = null;
}

/** Hover, completions, signature help and diagnostics for one file. */
export function pythonExtensions(service: PythonService, path: string): Extension {
  return service.client.plugin(pythonUri(path), "python");
}
