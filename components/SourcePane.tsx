/**
 * @file The Markdown pane: a page's MDX source, beside the page, opened by the terminal's
 * `md` command.
 *
 * Client component rendered by `Terminal`, only while the terminal is open. It fetches
 * `/source/<path>.md` (once per URL per page load) and prints it with line numbers,
 * dimming the frontmatter, imports and code fences and bolding the headings
 * (`lib/terminal/markdown-lines.ts`). The CSS places it: the right half of the window,
 * above the docked terminal or beside the full-screen one; on phones it covers the screen.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { classifyLines } from "@/lib/terminal/markdown-lines";

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

/** Props for {@link SourcePane}. */
interface SourcePaneProps {
  /** The source to show; `undefined` when the page has none (a topic, a section). */
  readonly url: string | undefined;
  /** The page's path in the terminal, e.g. `~/docs/python/overview`. */
  readonly path: string;
  /** Whether the pane follows `cd` (else it is pinned to one page). */
  readonly follow: boolean;
  readonly onClose: () => void;
}

/** The pane; see the file header. */
export function SourcePane({ url, path, follow, onClose }: SourcePaneProps) {
  // Keyed by URL, so a new URL shows "loading" until its own text arrives.
  const [loaded, setLoaded] = useState<{ url: string; text: string | null } | null>(null);

  useEffect(() => {
    if (url === undefined) return;
    let current = true;
    void loadSource(url).then((text) => {
      if (current) setLoaded({ url, text });
    });
    return () => {
      current = false;
    };
  }, [url]);

  const text = url !== undefined && loaded?.url === url ? loaded.text : undefined;
  const lines = useMemo(() => (typeof text === "string" ? classifyLines(text) : []), [text]);

  return (
    <aside className="source-pane" aria-label="Markdown source">
      <div className="terminal-bar">
        <span className="t-dim">
          md · {path}
          {follow ? " · follows cd" : ""}
        </span>
        <span>
          {url !== undefined && (
            <>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <i>raw</i>
              </a>
              {"  "}
            </>
          )}
          <button
            type="button"
            className="link"
            aria-label="Close the Markdown pane"
            onClick={onClose}
          >
            <i>close</i>
          </button>
        </span>
      </div>
      <div className="source-body" tabIndex={0} aria-label={`Markdown of ${path}`}>
        {url === undefined ? (
          <p className="t-dim">No Markdown here: cd into a sheet, a directory or a post.</p>
        ) : text === undefined ? (
          <p className="t-dim">loading…</p>
        ) : text === null ? (
          <p className="t-error">could not load {url}</p>
        ) : (
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
        )}
      </div>
    </aside>
  );
}
