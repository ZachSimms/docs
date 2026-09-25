/**
 * @file The ⌘K search palette.
 *
 * Client component mounted once in the root layout. It opens on ⌘K / Ctrl+K,
 * on `/` when no field is focused, or on the `open-search` window event fired
 * by the footer control. It lazily fetches the static `/search-index.json`,
 * ranks it with `lib/search-rank.ts` on every keystroke, and renders the
 * results as another "page" of the site laid over the current one.
 *
 * Accessibility: `role="dialog"` + `aria-modal`, the input is a `combobox`
 * controlling a `listbox` of `option`s, the rest of the document is made
 * `inert` while open, and focus returns to the opener on close.
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { BreakablePath } from "@/components/BreakablePath";
import { padNumber } from "@/lib/format";
import { isTypingTarget } from "@/lib/keys";
import { docPath, rankSearch, type SearchDoc, type SearchHit } from "@/lib/search-rank";
import { OPEN_SEARCH_EVENT } from "./SearchLink";

/** URL of the prerendered search index (see `app/search-index.json/route.ts`). */
export const SEARCH_INDEX_URL = "/search-index.json";
/** Hint shown in the empty search field; mirrors what `lib/search-rank.ts` matches. */
export const SEARCH_PLACEHOLDER = "Search titles, headings and text…";
/** Maximum results shown at once. */
const RESULT_LIMIT = 10;
/** DOM id of the results listbox, referenced by `aria-controls`. */
const RESULTS_ID = "search-results";

/** Module-level cache so the index is fetched once per page load, not once per open. */
let indexCache: Promise<SearchDoc[]> | undefined;

/**
 * Fetch and cache the search index.
 *
 * A failed request clears the cache so the next open retries instead of
 * remembering the failure for the rest of the session.
 *
 * @throws {Error} If the response is not OK; the rejection is cached-and-cleared as described.
 */
function loadIndex(): Promise<SearchDoc[]> {
  indexCache ??= fetch(SEARCH_INDEX_URL)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Search index request failed: ${res.status}`);
      return (await res.json()) as SearchDoc[];
    })
    .catch((error: unknown) => {
      indexCache = undefined; // allow a retry on the next open
      throw error;
    });
  return indexCache;
}

/** Test seam: forget the cached index. */
export function resetSearchIndexCache(): void {
  indexCache = undefined;
}

/** Lifecycle of the index inside the component. */
type IndexState = { status: "idle" | "loading" | "ready"; docs: SearchDoc[] } | { status: "error" };

/**
 * Make every top-level element except the dialog's own ancestor `inert`, so
 * the page behind the palette cannot be tabbed into or clicked.
 *
 * Elements that already carry `inert` are left alone so the undo does not
 * un-inert something another component owns.
 *
 * @param dialog - The palette's root element.
 * @returns A function that restores the previous state.
 */
function inertSiblings(dialog: HTMLElement): () => void {
  const siblings = [...document.body.children].filter(
    (el) => !el.contains(dialog) && !el.hasAttribute("inert"),
  );
  siblings.forEach((el) => el.setAttribute("inert", ""));
  return () => siblings.forEach((el) => el.removeAttribute("inert"));
}

/**
 * The palette itself. Renders `null` while closed; see the file header for
 * behaviour. Mount exactly once, in the root layout.
 */
export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const [index, setIndex] = useState<IndexState>({ status: "idle", docs: [] });
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const loadingRef = useRef(false);

  /** Close the palette; focus restoration happens in the open-state effect's cleanup. */
  const close = useCallback(() => setOpen(false), []);

  /**
   * Fetch the index the first time the palette opens. Called from event
   * handlers only (never from an effect) to keep state updates pure.
   */
  const ensureIndex = useCallback(() => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setIndex({ status: "loading", docs: [] });
    loadIndex()
      .then((docs) => setIndex({ status: "ready", docs }))
      .catch(() => {
        loadingRef.current = false;
        setIndex({ status: "error" });
      });
  }, []);

  /** Open the palette with a fresh query, remembering what had focus. */
  const show = useCallback(() => {
    openerRef.current = document.activeElement;
    setQuery("");
    setSelected(0);
    setIndex((current) => (current.status === "ready" ? current : { status: "idle", docs: [] }));
    ensureIndex();
    setOpen(true);
  }, [ensureIndex]);

  // Global shortcuts and the footer link's custom event.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) close();
        else show();
      } else if (event.key === "/" && !open && !isTypingTarget(event.target)) {
        event.preventDefault();
        show();
      } else if (event.key === "Escape" && open) {
        event.preventDefault(); // handled: page-level Esc (go up a level) must not also fire
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH_EVENT, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH_EVENT, show);
    };
  }, [open, close, show]);

  // While open: lock scroll, trap focus by making the page inert, and restore focus on close.
  useEffect(() => {
    if (!open || !dialogRef.current) return;
    document.body.setAttribute("data-search-open", "");
    const restoreInert = inertSiblings(dialogRef.current);
    inputRef.current?.focus();
    return () => {
      restoreInert();
      document.body.removeAttribute("data-search-open");
      const opener = openerRef.current;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [open]);

  const hits: SearchHit[] =
    index.status === "ready" ? rankSearch(index.docs, query, RESULT_LIMIT) : [];
  const current = Math.min(selected, Math.max(hits.length - 1, 0));

  /** Arrow keys move the selection; Enter navigates to the selected hit. */
  const onInputKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setSelected(Math.min(current + 1, Math.max(hits.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setSelected(Math.max(current - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = hits[current];
      if (hit) {
        close();
        router.push(hit.doc.url);
      }
    }
  };

  if (!open) return null;

  const status =
    index.status === "loading"
      ? "loading"
      : index.status === "error"
        ? "search index unavailable"
        : query.trim() && hits.length === 0
          ? "no results"
          : null;

  return (
    <div ref={dialogRef} className="search" role="dialog" aria-modal="true" aria-label="Search">
      <main>
        <h1>Search</h1>
        <p>-</p>
        <p>
          <label>
            {">"}{" "}
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setSelected(0);
              }}
              onKeyDown={onInputKey}
              placeholder={SEARCH_PLACEHOLDER}
              autoComplete="off"
              spellCheck={false}
              aria-label="Search cheatsheets"
              aria-autocomplete="list"
              aria-expanded={hits.length > 0}
              aria-controls={RESULTS_ID}
              aria-activedescendant={hits[current] ? `search-hit-${current}` : undefined}
            />
          </label>
        </p>
        <div id={RESULTS_ID} role="listbox" aria-label="Results" className="results">
          {hits.map((hit, i) => (
            <span key={hit.doc.url}>
              <span>{padNumber(hits.length - 1 - i)}.</span>{"\u00a0"}
              <Link
                id={`search-hit-${i}`}
                role="option"
                href={hit.doc.url}
                aria-selected={i === current}
                onClick={close}
                onMouseEnter={() => setSelected(i)}
              >
                <i>
                  <BreakablePath label={docPath(hit.doc)} />
                </i>
              </Link>
              <br />
            </span>
          ))}
        </div>
        {status && <p role="status">{status}</p>}
      </main>
      <footer>
        <p>
          <button type="button" className="link" aria-label="Close search" onClick={close}>
            <i>esc</i>
          </button>
        </p>
      </footer>
    </div>
  );
}
