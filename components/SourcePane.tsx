/**
 * @file The terminal's split: the right half of the terminal (below the shell on phones),
 * opened by `md`, showing a page either as its Markdown source or rendered.
 *
 * - `raw` fetches `/source/<path>.md` and prints it with line numbers, dimming the
 *   frontmatter, imports and code fences and bolding the headings
 *   (`lib/terminal/markdown-lines.ts`).
 * - `rendered` shows the page as the site renders it (the prerendered `<main>`, so code
 *   highlighting, math, tables and diagrams are all there), without its scripts or ids.
 *   Links in it navigate like the site's own.
 *
 * Client component, loaded by `Terminal` with `React.lazy` the first time `md` runs, so it
 * adds nothing to a page until then. Everything stays inside the terminal: the page
 * behind it never moves.
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { loadPageMain } from "@/lib/terminal/client";
import { classifyLines } from "@/lib/terminal/markdown-lines";
import type { SourceMode } from "@/lib/terminal/shell";

/** Fetched sources by URL; a failed request is forgotten so it can be retried. */
const cache = new Map<string, Promise<string | null>>();

/** The text of a source, or `null` when it cannot be loaded. */
function loadSource(url: string): Promise<string | null> {
  const cached = cache.get(url);
  if (cached) return cached;
  const loading = fetch(url)
    .then((res) => (res.ok ? res.text() : null))
    .catch(() => null)
    .then((text) => {
      if (text === null) cache.delete(url);
      return text;
    });
  cache.set(url, loading);
  return loading;
}

/** Test seam: forget fetched sources. */
export function resetSourceCache(): void {
  cache.clear();
}

/**
 * A page's `<main>` as HTML for the split: a copy without scripts (they would not run
 * anyway) and without ids (the page on screen may be the same one, and ids must be unique).
 */
export function renderedHtml(main: Element): string {
  const copy = main.cloneNode(true) as Element;
  copy.querySelectorAll("script").forEach((el) => el.remove());
  copy.querySelectorAll("[id]").forEach((el) => el.removeAttribute("id"));
  return copy.innerHTML;
}

/** What one load produced: raw text, rendered HTML, or `null` when it failed. */
type Loaded = { readonly key: string; readonly content: string | null };

/** Props for {@link SourcePane}. */
interface SourcePaneProps {
  readonly mode: SourceMode;
  /** The page's source URL; `undefined` when it has none (a topic, a section). */
  readonly source: string | undefined;
  /** The page's own URL; `undefined` until the shell knows where it is. */
  readonly href: string | undefined;
  /** The page's path in the terminal, e.g. `~/docs/python/overview`. */
  readonly path: string;
  /** Whether the split follows `cd` (else it is pinned to one page). */
  readonly follow: boolean;
  readonly onMode: (mode: SourceMode) => void;
  readonly onClose: () => void;
}

/** The split; see the file header. */
export function SourcePane({ mode, source, href, path, follow, onMode, onClose }: SourcePaneProps) {
  const router = useRouter();
  const url = mode === "raw" ? source : href;
  const key = `${mode} ${url}`;
  // Keyed by mode and URL, so a change shows "loading" until its own content arrives.
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (url === undefined) return;
    let current = true;
    const load =
      mode === "raw"
        ? loadSource(url)
        : loadPageMain(url).then((main) => (main ? renderedHtml(main) : null));
    void load.then((content) => {
      if (current) setLoaded({ key: `${mode} ${url}`, content });
    });
    return () => {
      current = false;
    };
  }, [mode, url]);

  const content = url !== undefined && loaded?.key === key ? loaded.content : undefined;
  const lines = useMemo(
    () => (mode === "raw" && typeof content === "string" ? classifyLines(content) : []),
    [mode, content],
  );

  /** Links in the rendered page navigate like the site's own (client-side, same tab). */
  const onRenderedClick = (event: MouseEvent<HTMLDivElement>) => {
    const link = (event.target as Element).closest("a");
    if (!link || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target) return;
    const to = new URL(link.href, window.location.href);
    if (to.origin !== window.location.origin) return;
    event.preventDefault();
    router.push(`${to.pathname}${to.search}${to.hash}`);
  };

  return (
    <div className="source-pane" role="region" aria-label="Markdown split">
      <div className="source-bar">
        <span className="t-dim">
          {path}
          {follow ? " · follows cd" : ""}
        </span>
        <span>
          <button
            type="button"
            className="link"
            aria-pressed={mode === "raw"}
            onClick={() => onMode("raw")}
          >
            <i>raw</i>
          </button>{" "}
          <button
            type="button"
            className="link"
            aria-pressed={mode === "rendered"}
            onClick={() => onMode("rendered")}
          >
            <i>rendered</i>
          </button>
          {"  "}
          {source !== undefined && (
            <>
              <a href={source} target="_blank" rel="noopener noreferrer" aria-label="Markdown file">
                <i>.md</i>
              </a>
              {"  "}
            </>
          )}
          <button type="button" className="link" aria-label="Close the split" onClick={onClose}>
            <i>close</i>
          </button>
        </span>
      </div>
      <div
        className="source-body"
        tabIndex={0}
        aria-label={`${path}, ${mode === "raw" ? "Markdown" : "rendered"}`}
      >
        {url === undefined ? (
          <p className="t-dim">
            {href === undefined
              ? "loading…"
              : "No Markdown here: cd into a sheet, a directory or a post, or md --rendered."}
          </p>
        ) : content === undefined ? (
          <p className="t-dim">loading…</p>
        ) : content === null ? (
          <p className="t-error">could not load {url}</p>
        ) : mode === "raw" ? (
          <pre>
            <code>
              {lines.map((line, i) => (
                <span key={i} className={`src-line src-${line.kind}`}>
                  <span className="src-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span>{line.text || " "}</span>
                  {"\n"}
                </span>
              ))}
            </code>
          </pre>
        ) : (
          // The site's own prerendered page, fetched from this origin (see renderedHtml).
          <div
            className="source-rendered"
            onClick={onRenderedClick}
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </div>
    </div>
  );
}
