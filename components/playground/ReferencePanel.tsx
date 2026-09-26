/**
 * @file The reference panel: search the sheets and read one beside the code.
 *
 * Client component. Search uses the same index and ranking as the ⌘K palette.
 * With the box empty it suggests sheets for the current language. A chosen
 * sheet opens in a same-origin frame; the page inside marks itself
 * `data-embed` (see `EMBED_INIT_SCRIPT`), which hides the site chrome. The
 * frame follows the playground's theme. ⌘K on the playground opens sheets
 * here too: the palette dispatches `open-reference`, the playground passes it
 * in as `requested`.
 */

"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BreakablePath } from "@/components/BreakablePath";
import { Splitter } from "@/components/playground/Splitter";
import { useTheme } from "@/components/useTheme";
import { padNumber } from "@/lib/format";
import type { SheetRef } from "@/lib/playground/languages";
import { isSheetUrl } from "@/lib/reference-panel";
import { loadSearchIndex } from "@/lib/search-index-client";
import { docPath, rankSearch, type SearchDoc } from "@/lib/search-rank";

/** Most results listed. */
const RESULT_LIMIT = 12;

/** Props for {@link ReferencePanel}. */
interface ReferencePanelProps {
  /** Suggestions for the current language. */
  suggestions: readonly SheetRef[];
  width: number;
  onWidth(width: number): void;
  onClose(): void;
  /** A sheet asked for from elsewhere (⌘K); `n` changes on every request. */
  requested: { url: string; n: number } | null;
}

/** Render the panel. */
export function ReferencePanel({
  suggestions,
  width,
  onWidth,
  onClose,
  requested,
}: ReferencePanelProps) {
  const [query, setQuery] = useState("");
  const [docs, setDocs] = useState<SearchDoc[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(0);
  const [url, setUrl] = useState<string | null>(requested?.url ?? null);
  const frame = useRef<HTMLIFrameElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const theme = useTheme();

  useEffect(() => {
    let live = true;
    loadSearchIndex().then(
      (index) => live && setDocs(index),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, []);

  // A sheet requested while the panel is open (⌘K again).
  const [seen, setSeen] = useState(requested?.n ?? 0);
  if (requested && requested.n !== seen) {
    setSeen(requested.n);
    setUrl(requested.url);
  }

  /** Copy the playground's theme into the sheet frame (it doesn't see this page's toggle). */
  const syncTheme = () => {
    try {
      const root = frame.current?.contentDocument?.documentElement;
      if (root && theme) root.setAttribute("data-theme", theme);
    } catch {
      // Not same-origin (shouldn't happen for sheet URLs): leave the frame's own theme.
    }
  };
  useEffect(syncTheme);

  const hits = docs && query.trim() ? rankSearch(docs, query, RESULT_LIMIT) : [];
  const items: { url: string; label: string }[] = (
    query.trim()
      ? hits.map((h) => ({ url: h.doc.url, label: docPath(h.doc) }))
      : suggestions.map((s) => ({ url: s.href, label: s.label }))
  ).filter((item) => isSheetUrl(item.url));
  const current = Math.min(selected, Math.max(items.length - 1, 0));

  const onSearchKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected(Math.min(current + 1, items.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected(Math.max(current - 1, 0));
    } else if (event.key === "Enter" && items[current]) {
      event.preventDefault();
      setUrl(items[current].url);
    } else if (event.key === "Escape") {
      event.preventDefault();
      if (query) setQuery("");
      else onClose();
    }
  };

  return (
    <aside className="pg-refs" aria-label="Reference sheets">
      <Splitter part="refs" edge="left" size={width} onSize={onWidth} />
      <div className="pg-bar">
        <label className="pg-refs-search">
          <span>Refs</span>
          <input
            ref={input}
            type="search"
            role="combobox"
            value={query}
            placeholder="Search sheets…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Search reference sheets"
            aria-controls="pg-refs-results"
            aria-expanded={!url && items.length > 0}
            aria-activedescendant={!url && items[current] ? `pg-ref-${current}` : undefined}
            onFocus={() => setUrl(null)}
            onChange={(event) => {
              setQuery(event.target.value);
              setSelected(0);
              setUrl(null);
            }}
            onKeyDown={onSearchKey}
          />
        </label>
        <button type="button" className="link" aria-label="Close reference panel" onClick={onClose}>
          <i>✕</i>
        </button>
      </div>
      {url ? (
        <div className="pg-refs-sheet">
          <div className="pg-bar">
            <button
              type="button"
              className="link"
              onClick={() => (setUrl(null), input.current?.focus())}
            >
              <i>← results</i>
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <i>↗ new tab</i>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </div>
          <iframe
            ref={frame}
            src={url}
            // Site sheets need their own origin (theme, search) and new-tab links, but may never
            // navigate the playground itself; the flags stay if the frame goes elsewhere.
            sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            title={`Reference: ${url}`}
            className="pg-refs-frame"
            onLoad={syncTheme}
          />
        </div>
      ) : (
        <div className="pg-refs-list">
          {!query.trim() && <p className="pg-muted">Suggested for this language:</p>}
          <div id="pg-refs-results" role="listbox" aria-label="Sheets">
            {items.map((item, i) => (
              <span key={item.url} className="pg-ref-row">
                <span>{padNumber(i)}.</span>
                {" "}
                <a
                  id={`pg-ref-${i}`}
                  role="option"
                  href={item.url}
                  aria-selected={i === current}
                  onMouseEnter={() => setSelected(i)}
                  onClick={(event) => {
                    event.preventDefault();
                    setUrl(item.url);
                  }}
                >
                  <i>
                    <BreakablePath label={item.label} />
                  </i>
                </a>
              </span>
            ))}
          </div>
          {query.trim() && docs && hits.length === 0 && <p role="status">no results</p>}
          {failed && <p role="status">search index unavailable</p>}
        </div>
      )}
    </aside>
  );
}
