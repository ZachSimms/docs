/**
 * @file The editor side of the TypeScript language service.
 *
 * Client-only. `tsService` starts one worker per page (lazily, on the first
 * JS/TS file opened) and `tsExtensions` gives a file its hover, completions
 * and diagnostics. Diagnostics are warnings: runs strip types without checking
 * them, so a type error never stops a program.
 */

"use client";

import { autocompletion } from "@codemirror/autocomplete";
import { linter, type Diagnostic } from "@codemirror/lint";
import { StateEffect, type Extension } from "@codemirror/state";
import { ViewPlugin, type EditorView } from "@codemirror/view";
import {
  tsAutocompleteWorker,
  tsFacetWorker,
  tsHoverWorker,
  tsSyncWorker,
  type HoverInfo,
} from "@valtown/codemirror-ts";
import * as Comlink from "comlink";
import { TS_LIB_URL, vfsPath } from "@/lib/playground/intellisense/ts-config";
import type { TsService } from "./ts.worker";

/** A started service, and the editors to re-lint when downloaded types arrive. */
interface Running {
  readonly remote: Comlink.Remote<TsService>;
  readonly views: Set<EditorView>;
  readonly worker: Worker;
}

let running: { bunTypes: boolean; ready: Promise<Running> } | null = null;

/** Dispatched when downloaded types arrive, so the linter runs again. */
const typesArrived = StateEffect.define<null>();

/**
 * The page's TypeScript service, started on first use. Asking with different
 * `bunTypes` (another project type) restarts it.
 */
export function tsService(bunTypes: boolean): Promise<Running> {
  if (running?.bunTypes === bunTypes) return running.ready;
  if (running)
    void running.ready.then(
      (r) => r.worker.terminate(),
      () => undefined,
    );
  const views = new Set<EditorView>();
  const worker = new Worker(new URL("./ts.worker.ts", import.meta.url), {
    type: "module",
    name: "typescript",
  });
  const remote = Comlink.wrap<TsService>(worker);
  const onTypes = () =>
    views.forEach(
      (view) => view.dom.isConnected && view.dispatch({ effects: typesArrived.of(null) }),
    );
  const ready = remote
    .start({ libUrl: TS_LIB_URL, bunTypes }, Comlink.proxy(onTypes))
    .then(() => ({ remote, views, worker }));
  // A failed start (offline, old browser) is remembered, so edits don't restart it again and again.
  ready.catch(() => worker.terminate());
  running = { bunTypes, ready };
  return ready;
}

/** Stop the service (tests, and leaving the page). */
export function stopTsService(): void {
  if (running)
    void running.ready.then(
      (r) => r.worker.terminate(),
      () => undefined,
    );
  running = null;
}

/** Type errors as warnings (see the file comment). */
export function asWarnings(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.map((d) => (d.severity === "error" ? { ...d, severity: "warning" } : d));
}

/** A hover card: the signature, then the documentation and its tags. */
export function renderHover(info: HoverInfo): { dom: HTMLElement } {
  const dom = document.createElement("div");
  dom.className = "pg-hover";
  const quick = info.quickInfo;
  if (quick?.displayParts?.length) {
    const code = dom.appendChild(document.createElement("code"));
    code.className = "pg-hover-sig";
    code.textContent = quick.displayParts.map((p) => p.text).join("");
  }
  const docs = quick?.documentation?.map((p) => p.text).join("") ?? "";
  if (docs) dom.appendChild(document.createElement("p")).textContent = docs;
  for (const tag of quick?.tags ?? []) {
    const line = dom.appendChild(document.createElement("p"));
    line.className = "pg-hover-tag";
    line.textContent = `@${tag.name} ${tag.text?.map((p) => p.text).join("") ?? ""}`.trim();
  }
  return { dom };
}

/**
 * Hover, completions and diagnostics for one file.
 *
 * @param service - From {@link tsService}.
 * @param path - The project path of the open file.
 */
export function tsExtensions(service: Running, path: string): Extension {
  const worker = service.remote as unknown as Parameters<typeof tsFacetWorker.of>[0]["worker"];
  return [
    tsFacetWorker.of({ worker, path: vfsPath(path) }),
    tsSyncWorker(),
    linter(
      async (view) =>
        asWarnings(await service.remote.getLints({ path: vfsPath(path) })).filter(
          // A diagnostic can refer to text the user has since deleted.
          (d) => d.to <= view.state.doc.length,
        ),
      {
        delay: 400,
        needsRefresh: (update) =>
          update.transactions.some((tr) => tr.effects.some((e) => e.is(typesArrived))),
      },
    ),
    autocompletion({ override: [tsAutocompleteWorker()] }),
    tsHoverWorker({ renderTooltip: renderHover }),
    // Track live views so downloaded types re-lint them; destroyed or reconfigured views drop out.
    ViewPlugin.define((view) => {
      service.views.add(view);
      return { destroy: () => service.views.delete(view) };
    }),
  ];
}
