/**
 * @file Table of contents shown in the right margin of a cheatsheet.
 *
 * Client component: the entries arrive as props from the server; the client
 * work is tracking which section is being read and keeping it in view. The
 * rail is fixed and hidden by CSS on viewports too narrow to fit it beside the
 * content column.
 */

"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  keepVisible,
  moreContent,
  parentOf,
  pickActive,
  type MoreContent,
  type TocEntry,
} from "@/lib/toc";

/** Props for {@link Toc}. */
interface TocProps {
  /** Headings in document order; render nothing when there are fewer than two. */
  entries: readonly TocEntry[];
}

/** Fraction of the viewport height, from the top, that a heading must reach to become current. */
const READING_LINE = 0.3;
/** Pixels of slack when deciding the page is scrolled to the bottom. */
const BOTTOM_SLACK = 2;
/** Space kept between the current entry and the edge of the TOC's own scroll box. */
const SCROLL_MARGIN = 24;

/** Share of the contents' visible height that one click on a `^`/`v` indicator scrolls. */
const PAGE_STEP = 0.8;
/** Nothing hidden in either direction: what the server renders. */
const NO_MORE: MoreContent = { up: false, down: false };

/** Window events that mean the reader is scrolling on purpose, which ends a pin. */
const READER_SCROLL_EVENTS = ["wheel", "touchmove", "keydown", "pointerdown"] as const;

/**
 * A heading's distance from the viewport top; `Infinity` when it is missing or
 * not rendered (inside a closed `<details>` or an inactive tab panel), so it
 * never counts as reached.
 */
function headingTop(id: string): number {
  const el = document.getElementById(id);
  if (!el) return Infinity;
  if (typeof el.checkVisibility === "function" && !el.checkVisibility()) return Infinity;
  return el.getBoundingClientRect().top;
}

/** Index of the section being read, recomputed from the headings' positions. */
function currentIndex(ids: readonly string[]): number {
  const tops = ids.map(headingTop);
  const doc = document.documentElement;
  const atBottom =
    window.scrollY > 0 && window.innerHeight + window.scrollY >= doc.scrollHeight - BOTTOM_SLACK;
  return pickActive(tops, window.innerHeight * READING_LINE, atBottom);
}

/**
 * Track the index of the section being read.
 *
 * Recomputes on `scroll` and `resize` (throttled to one update per frame).
 * Following a link to a heading (a TOC click or any `#hash` change) pins that
 * heading as current until the reader scrolls on purpose: a short section
 * jumped to near the end of a page may never reach the reading line, and the
 * position rule alone would highlight its neighbour.
 * Before hydration, and until the first scroll, the first entry is current,
 * which is also what the server renders.
 *
 * @returns The current index and `pin(index)` for the TOC's own click handler.
 */
function useActiveIndex(ids: readonly string[]): readonly [number, (index: number) => void] {
  const [active, setActive] = useState(0);
  const pinned = useRef<number | null>(null);
  const key = ids.join("\n");

  const pin = (index: number) => {
    pinned.current = index;
    setActive(index);
  };

  useEffect(() => {
    const list = key.split("\n");
    let frame = 0;
    const update = () => {
      frame = 0;
      if (pinned.current === null) setActive(Math.max(currentIndex(list), 0));
    };
    const schedule = () => {
      if (frame === 0) frame = requestAnimationFrame(update);
    };
    const unpin = () => {
      pinned.current = null;
    };
    const onHash = () => {
      const index = list.indexOf(decodeURIComponent(location.hash.slice(1)));
      if (index !== -1) {
        pinned.current = index;
        setActive(index);
      }
    };
    update();
    onHash(); // a page opened at #heading starts pinned to it
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    window.addEventListener("hashchange", onHash);
    READER_SCROLL_EVENTS.forEach((type) =>
      window.addEventListener(type, unpin, { passive: true, capture: true }),
    );
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("hashchange", onHash);
      READER_SCROLL_EVENTS.forEach((type) =>
        window.removeEventListener(type, unpin, { capture: true }),
      );
    };
  }, [key]);

  return [active, pin] as const;
}

/**
 * Track whether the contents list has entries hidden above or below its box.
 *
 * Re-measured when the list scrolls (by the reader or by the auto-scroll that
 * keeps the current entry visible) and when the window resizes.
 *
 * @returns The current state and `measure()` to call after changing `scrollTop`.
 */
function useMoreContent(
  navRef: RefObject<HTMLElement | null>,
): readonly [MoreContent, () => void] {
  const [more, setMore] = useState<MoreContent>(NO_MORE);

  const measure = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const next = moreContent({
      scrollTop: nav.scrollTop,
      height: nav.clientHeight,
      scrollHeight: nav.scrollHeight,
    });
    setMore((prev) => (prev.up === next.up && prev.down === next.down ? prev : next));
  }, [navRef]);

  useEffect(() => {
    const nav = navRef.current;
    measure();
    nav?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      nav?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [navRef, measure]);

  return [more, measure] as const;
}

/**
 * Scroll the contents list by most of its visible height (`direction` 1 = down).
 * Smooth unless the reader prefers reduced motion.
 */
function scrollContents(nav: HTMLElement | null, direction: 1 | -1): void {
  if (!nav) return;
  const reduce =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  nav.scrollBy({
    top: direction * nav.clientHeight * PAGE_STEP,
    behavior: reduce ? "auto" : "smooth",
  });
}

/**
 * Render the table of contents as a dotted-link list. `###` entries are
 * indented by two characters. The current entry gets `aria-current="location"`
 * (bold, solid underline and a `>` marker in the gutter); when it is a `###`,
 * its `##` gets `data-parent-active` (marker only). The list scrolls itself so
 * the current entry stays visible, without ever scrolling the page.
 *
 * The list has no scrollbar. Where entries are hidden above or below, that
 * edge fades out (`data-more-up` / `data-more-down` on the nav, used by the
 * CSS mask) and a `^` / `v` button sits in the marker gutter; clicking it
 * scrolls the list by most of a box height.
 */
export function Toc({ entries }: TocProps) {
  const [active, pin] = useActiveIndex(entries.map((e) => e.id));
  const parent = parentOf(entries, active);
  const navRef = useRef<HTMLElement>(null);
  const [more, measure] = useMoreContent(navRef);

  useEffect(() => {
    const nav = navRef.current;
    const link = nav?.querySelectorAll<HTMLElement>("a")[active];
    if (!nav || !link) return;
    nav.scrollTop = keepVisible(
      { top: link.offsetTop, height: link.offsetHeight },
      { scrollTop: nav.scrollTop, height: nav.clientHeight },
      SCROLL_MARGIN,
    );
    measure();
  }, [active, measure]);

  if (entries.length < 2) return null;

  return (
    <div className="toc-rail">
      <div className="toc-frame">
        {more.up && (
          <button
            type="button"
            className="toc-more toc-more-up"
            aria-label="Scroll contents up"
            tabIndex={-1}
            onClick={() => scrollContents(navRef.current, -1)}
          >
            ^
          </button>
        )}
        <nav
          ref={navRef}
          className="toc"
          aria-label="Contents"
          data-more-up={more.up ? "" : undefined}
          data-more-down={more.down ? "" : undefined}
        >
          {entries.map((entry, i) => (
            <a
              key={entry.id}
              href={`#${entry.id}`}
              className={entry.depth === 3 ? "toc-sub" : undefined}
              aria-current={i === active ? "location" : undefined}
              data-parent-active={i === parent ? "" : undefined}
              onClick={() => pin(i)}
            >
              <i>{entry.text}</i>
            </a>
          ))}
        </nav>
        {more.down && (
          <button
            type="button"
            className="toc-more toc-more-down"
            aria-label="Scroll contents down"
            tabIndex={-1}
            onClick={() => scrollContents(navRef.current, 1)}
          >
            v
          </button>
        )}
      </div>
    </div>
  );
}
