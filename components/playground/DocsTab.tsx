/**
 * @file The reference panel's Docs tab: search the official docs for the current project.
 *
 * Client component. Loads the committed DevDocs manifest, then each docset's
 * search index when first needed (they're a few KB to a few hundred KB).
 * Choosing an entry shows it in {@link DocsView}; "← back" walks the pages
 * opened from links. Sites DevDocs doesn't carry (Hono, Tailwind) open framed.
 */

"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { padNumber } from "@/lib/format";
import {
  DOCS_FOR,
  FRAMED_FOR,
  indexUrl,
  NEXTJS_CURRENT_DOCS,
  parseIndex,
  parseManifest,
  searchDocs,
  type DocEntry,
  type Docset,
  type FramedSource,
} from "@/lib/playground/docs";
import type { LanguageId } from "@/lib/playground/languages";
import type { DocRequest } from "@/lib/reference-panel";
import { DocsView } from "./DocsView";

/** The committed manifest (see `scripts/build-docs-manifest.ts`). */
export const DOCS_MANIFEST_URL = "/playground/docs-manifest.json";

let manifestCache: Promise<Docset[]> | undefined;
const indexCache = new Map<string, Promise<DocEntry[]>>();

/** Load the manifest once per page. */
function loadManifest(): Promise<Docset[]> {
  manifestCache ??= fetch(DOCS_MANIFEST_URL)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(parseManifest)
    .catch((error: unknown) => {
      manifestCache = undefined;
      throw error;
    });
  return manifestCache;
}

/** Load one docset's index once per page. */
function loadIndex(set: Docset): Promise<DocEntry[]> {
  const cached = indexCache.get(set.slug);
  if (cached) return cached;
  const pending = fetch(indexUrl(set), { credentials: "omit", referrerPolicy: "no-referrer" })
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then((json) => parseIndex(set.slug, json))
    .catch((error: unknown) => {
      indexCache.delete(set.slug);
      throw error;
    });
  indexCache.set(set.slug, pending);
  return pending;
}

/** Test seam: forget cached indexes and the manifest. */
export function resetDocsCache(): void {
  manifestCache = undefined;
  indexCache.clear();
}

/** A page being shown, plus the pages before it (for "← back"). */
interface Opened {
  readonly slug: string;
  readonly path: string;
  readonly name: string;
}

/** Props for {@link DocsTab}. */
interface DocsTabProps {
  language: LanguageId;
  /** A page to show (from an editor hover); `n` changes on every request. */
  requested?: (DocRequest & { n: number }) | null;
  /** The requested page is showing. */
  onShown?(): void;
}

/** Render the tab. */
export function DocsTab({ language, requested = null, onShown }: DocsTabProps) {
  /** Every docset (a hover can open one the project doesn't list). */
  const [allSets, setAllSets] = useState<Docset[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [source, setSource] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [entries, setEntries] = useState<DocEntry[]>([]);
  const [selected, setSelected] = useState(0);
  const [stack, setStack] = useState<readonly Opened[]>(requested ? [requested] : []);
  const [framed, setFramed] = useState<FramedSource | null>(null);
  const input = useRef<HTMLInputElement>(null);

  // A page asked for from a hover replaces whatever the tab shows, framed sites included.
  const [seen, setSeen] = useState(requested?.n ?? 0);
  if (requested && requested.n !== seen) {
    setSeen(requested.n);
    setStack([requested]);
    setFramed(null);
  }
  useEffect(() => {
    if (requested) onShown?.();
  }, [requested, onShown]);

  // Another project: its own docsets, so forget a source picked for the last one.
  const [sourceFor, setSourceFor] = useState(language);
  if (sourceFor !== language) {
    setSourceFor(language);
    setSource("all");
  }

  useEffect(() => {
    let live = true;
    loadManifest().then(
      (all) => live && (setAllSets(all), setFailed(false)),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);

  const sets = useMemo(
    () => allSets?.filter((s) => DOCS_FOR[language].includes(s.slug)) ?? null,
    [allSets, language],
  );

  const active = useMemo(
    () => (sets ?? []).filter((s) => source === "all" || s.slug === source),
    [sets, source],
  );

  // Load the indexes of the chosen sources once the reader starts typing.
  useEffect(() => {
    if (!query.trim() || active.length === 0) return;
    let live = true;
    Promise.allSettled(active.map(loadIndex)).then((results) => {
      if (!live) return;
      setEntries(results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])));
      setFailed(results.every((r) => r.status === "rejected"));
    });
    return () => {
      live = false;
    };
  }, [active, query]);

  const hits = useMemo(
    () =>
      searchDocs(
        entries.filter((e) => active.some((s) => s.slug === e.slug)),
        query,
      ),
    [entries, active, query],
  );
  const current = Math.min(selected, Math.max(hits.length - 1, 0));
  const opened = stack.at(-1);
  const openedSet = opened && allSets?.find((s) => s.slug === opened.slug);
  const extras = FRAMED_FOR[language] ?? [];

  const open = (entry: DocEntry) =>
    setStack([{ slug: entry.slug, path: entry.path, name: entry.name }]);

  const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected(Math.min(current + 1, hits.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected(Math.max(current - 1, 0));
    } else if (event.key === "Enter" && hits[current]) {
      event.preventDefault();
      open(hits[current]);
    }
  };

  if (framed) {
    return (
      <div className="pg-docs">
        <div className="pg-bar">
          <button type="button" className="link" onClick={() => setFramed(null)}>
            <i>← docs</i>
          </button>
          <a href={framed.url} target="_blank" rel="noopener noreferrer">
            <i>↗ new tab</i>
          </a>
        </div>
        <iframe
          src={framed.url}
          title={framed.name}
          className="pg-docs-frame"
          // Their own site and scripts, but it may never navigate the playground; its popups
          // stay sandboxed too, so they can't navigate it through `opener` either.
          sandbox="allow-scripts allow-same-origin allow-popups"
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  if (opened && openedSet) {
    return (
      <div className="pg-docs">
        <div className="pg-bar">
          <button
            type="button"
            className="link"
            onClick={() =>
              stack.length > 1
                ? setStack(stack.slice(0, -1))
                : (setStack([]), input.current?.focus())
            }
          >
            <i>{stack.length > 1 ? "← back" : "← results"}</i>
          </button>
          <span className="pg-muted">{openedSet.name}</span>
        </div>
        <DocsView
          set={openedSet}
          path={opened.path}
          name={opened.name}
          onNavigate={(path, name) =>
            setStack([...stack, { slug: opened.slug, path, name }].slice(-30))
          }
        />
      </div>
    );
  }

  return (
    <div className="pg-docs">
      <div className="pg-docs-search">
        <select aria-label="Docs source" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">all sources</option>
          {(sets ?? []).map((s) => (
            <option key={s.slug} value={s.slug}>
              {s.name}
              {s.release ? ` ${s.release}` : ""}
            </option>
          ))}
        </select>
        <input
          ref={input}
          type="search"
          role="combobox"
          aria-label="Search the official docs"
          aria-controls="pg-docs-results"
          aria-expanded={hits.length > 0}
          aria-activedescendant={hits[current] ? `pg-doc-${current}` : undefined}
          placeholder="Search the official docs…"
          value={query}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(0);
          }}
          onKeyDown={onKey}
        />
      </div>
      <div className="pg-refs-list">
        {!query.trim() && (
          <>
            <p className="pg-muted">
              Official references for this project, from{" "}
              {sets?.map((s) => s.name).join(", ") || "…"}. Pages come via DevDocs and keep their
              licenses and attribution.
            </p>
            {language === "nextjs" && (
              <p>
                DevDocs has Next.js 14.2 docs; for the current version open{" "}
                <a href={NEXTJS_CURRENT_DOCS} target="_blank" rel="noopener noreferrer">
                  <i>nextjs.org/docs</i>
                </a>
                .
              </p>
            )}
            {extras.map((extra) => (
              <p key={extra.id}>
                <button type="button" className="link" onClick={() => setFramed(extra)}>
                  <i>{extra.name}</i>
                </button>
              </p>
            ))}
          </>
        )}
        <div id="pg-docs-results" role="listbox" aria-label="Docs">
          {hits.map((hit, i) => (
            <span key={`${hit.slug}:${hit.path}`} className="pg-ref-row">
              <span>{padNumber(i)}.</span>
              {" "}
              <a
                id={`pg-doc-${i}`}
                role="option"
                href="#"
                aria-selected={i === current}
                onMouseEnter={() => setSelected(i)}
                onClick={(event) => {
                  event.preventDefault();
                  open(hit);
                }}
              >
                <i>{hit.name}</i>
              </a>{" "}
              <span className="pg-muted">
                {hit.type} · {sets?.find((s) => s.slug === hit.slug)?.name}
              </span>
            </span>
          ))}
        </div>
        {query.trim() && entries.length > 0 && hits.length === 0 && <p role="status">no results</p>}
        {failed && (
          <p role="status">
            Docs unavailable right now (DevDocs didn&apos;t answer). The official sites still work
            in a new tab.
          </p>
        )}
      </div>
    </div>
  );
}
