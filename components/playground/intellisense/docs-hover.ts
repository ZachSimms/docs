/**
 * @file Docs hovers (and name completions) for C++, Rust, GDScript, HTML and CSS.
 *
 * Client-only. Loads the language's hover file once per page (see
 * `scripts/build-hover-docs.ts`), then shows the signature and summary of the
 * name under the pointer with the docset's attribution, and an "Open docs"
 * button that shows the full page in the reference panel's Docs tab.
 */

"use client";

import { completeFromList } from "@codemirror/autocomplete";
import { EditorState, type Extension } from "@codemirror/state";
import { hoverTooltip } from "@codemirror/view";
import {
  buildHoverIndex,
  completionNames,
  hoverFileUrl,
  lookupHover,
  nameAt,
  parseHoverFile,
  type HoverDocEntry,
  type HoverDocFile,
  type HoverIndex,
  type HoverLanguage,
} from "@/lib/playground/hover-docs";
import { openDocs } from "@/lib/reference-panel";

/** A loaded hover file. */
export interface HoverDocs {
  readonly lang: HoverLanguage;
  readonly file: HoverDocFile;
  readonly index: HoverIndex;
}

const cache = new Map<HoverLanguage, Promise<HoverDocs>>();

/** Load a language's hover file (once per page). */
export function loadHoverDocs(lang: HoverLanguage): Promise<HoverDocs> {
  const cached = cache.get(lang);
  if (cached) return cached;
  const pending = fetch(hoverFileUrl(lang))
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((json) => {
      const file = parseHoverFile(json);
      return { lang, file, index: buildHoverIndex(file, lang) };
    });
  pending.catch(() => cache.delete(lang));
  cache.set(lang, pending);
  return pending;
}

/** The hover card: each match's signature and summary, then the source. */
export function renderDocsHover(
  docs: HoverDocs,
  entries: readonly HoverDocEntry[],
  total: number,
): HTMLElement {
  const dom = document.createElement("div");
  dom.className = "pg-hover";
  for (const entry of entries) {
    const section = dom.appendChild(document.createElement("div"));
    section.className = "pg-hover-entry";
    const sig = section.appendChild(document.createElement("code"));
    sig.className = "pg-hover-sig";
    sig.textContent = entry.signature ?? entry.name;
    if (entry.signature) {
      const name = section.appendChild(document.createElement("span"));
      name.className = "pg-hover-name";
      name.textContent = entry.name;
    }
    section.appendChild(document.createElement("p")).textContent = entry.summary;
    const open = section.appendChild(document.createElement("button"));
    open.type = "button";
    open.className = "link pg-hover-open";
    open.appendChild(document.createElement("i")).textContent = "Open docs";
    open.addEventListener("click", () =>
      openDocs({ slug: docs.file.slug, path: entry.path, name: entry.name }),
    );
  }
  if (total > entries.length) {
    const more = dom.appendChild(document.createElement("p"));
    more.className = "pg-hover-tag";
    more.textContent = `+${total - entries.length} more with this name`;
  }
  const credit = dom.appendChild(document.createElement("p"));
  credit.className = "pg-hover-credit";
  credit.textContent = `${docs.file.docs} · ${docs.file.attribution} · via DevDocs`;
  return dom;
}

/** Languages whose editor package has no completions of its own. */
const COMPLETE: ReadonlySet<HoverLanguage> = new Set(["cpp", "rust", "gdscript"]);

/** The hover (and, where the language lacks them, completions) for one file. */
export function docsHoverExtensions(docs: HoverDocs): Extension {
  const hover = hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const hit = nameAt(line.text, pos - line.from, docs.lang);
    if (!hit) return null;
    const { entries, total } = lookupHover(docs.index, hit.name, docs.lang);
    if (entries.length === 0) return null;
    return {
      pos: line.from + hit.from,
      end: line.from + hit.to,
      create: () => ({ dom: renderDocsHover(docs, entries, total) }),
    };
  });
  if (!COMPLETE.has(docs.lang)) return hover;
  const options = completionNames(docs.file).map((c) => ({ ...c, type: "function" }));
  return [hover, EditorState.languageData.of(() => [{ autocomplete: completeFromList(options) }])];
}
