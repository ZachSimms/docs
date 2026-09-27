/**
 * @file The keyboard/mouse menu behind every list of links a page offers as its menu:
 * the numbered rows (`NumberedList`), the topic cards on `/docs/` (`TopicCards`) and
 * a topic's folders and sheets (`TopicIndex`).
 *
 * `↓`/`j` and `↑`/`k` move a highlight (wrapping, and repeating while held) and focus
 * the row, `Enter`, `→` or `l` opens it, and moving the mouse over a row or focusing
 * it moves the same highlight. After going up a level (`ParentLink`), the row for the
 * page just left starts highlighted, so `→` goes straight back in. Rows are the
 * `a[data-row]` elements inside the menu's `<nav data-menu>`, in document order, so a
 * menu may lay its rows out in cards, columns or sections. Only the first menu on a
 * page listens to the keyboard.
 */

"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import {
  IN_KEYS,
  arrowsNavigate,
  forgetCameFrom,
  isAnyPlainKey,
  isOverlayOpen,
  isPlainKey,
  nextIndex,
  peekCameFrom,
  type KeyLike,
} from "@/lib/keys";

/** Keys that move the highlight, mapped to their direction. */
const MOVES: Readonly<Record<string, 1 | -1>> = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 };

/** Selector for a menu's rows, relative to its `<nav>`. */
export const ROW_SELECTOR = "a[data-row]";

/** The direction a key moves the highlight, or `undefined` if it is not a menu key. */
function moveFor(event: KeyLike): 1 | -1 | undefined {
  const delta = MOVES[event.key];
  return delta !== undefined && isPlainKey(event, event.key, { allowRepeat: true })
    ? delta
    : undefined;
}

/** Index of the row leading back to the page just left by going up, or `null`. */
function cameFromIndex(hrefs: readonly string[]): number | null {
  const from = peekCameFrom();
  const index = from === null ? -1 : hrefs.indexOf(from);
  return index === -1 ? null : index;
}

/** Whether no element has keyboard focus (so a bare `Enter` belongs to the menu). */
function nothingFocused(): boolean {
  const focused = document.activeElement;
  return focused === null || focused === document.body;
}

/** Props a row's link spreads to join the menu. */
export interface RowProps {
  readonly "data-row": "";
  readonly "data-active": "" | undefined;
  /** Only the highlighted row prefetches: a sheet's payload averages ~200 KB. */
  readonly prefetch: null | false;
  readonly onMouseMove: (() => void) | undefined;
  readonly onFocus: () => void;
}

/** What {@link useMenu} gives its list. */
export interface Menu {
  /** Attach to the `<nav data-menu>` that holds the rows. */
  readonly navRef: RefObject<HTMLElement | null>;
  /** Index of the highlighted row, or `null`. */
  readonly active: number | null;
  /** Props for the link of row `index`. */
  readonly rowProps: (index: number) => RowProps;
}

/**
 * Make the rows under a `<nav data-menu>` a keyboard/mouse menu.
 *
 * `Enter` only opens the highlighted row when nothing else has focus; with a row
 * focused the browser follows the link itself, and with another control focused
 * (a button, the footer, a tab) the keystroke is left alone. Highlighting follows
 * `mousemove`, not `mouseenter`, so rows sliding under a still pointer while the
 * page scrolls do not steal the highlight.
 *
 * @param hrefs - Each row's destination, in document order.
 */
export function useMenu(hrefs: readonly string[]): Menu {
  // A client-side mount after going up starts on the row we came from; a full
  // page load has nothing remembered, so hydration matches the server's markup.
  const [active, setActive] = useState<number | null>(() => cameFromIndex(hrefs));
  const activeRef = useRef<number | null>(active);
  const navRef = useRef<HTMLElement>(null);
  const count = hrefs.length;

  /** Update the highlight for rendering and for the (registered-once) key handler. */
  const highlight = (index: number) => {
    activeRef.current = index;
    setActive(index);
  };

  useEffect(() => forgetCameFrom(), []);

  useEffect(() => {
    const nav = navRef.current;
    const links = () => [...(nav?.querySelectorAll<HTMLAnchorElement>(ROW_SELECTOR) ?? [])];

    const onKey = (event: KeyboardEvent) => {
      if (!nav || document.querySelector("nav[data-menu]") !== nav || isOverlayOpen()) return;
      const delta = moveFor(event);
      if (delta !== undefined) {
        const next = nextIndex(activeRef.current, delta, count);
        if (next === null) return;
        event.preventDefault();
        activeRef.current = next;
        setActive(next);
        links()[next]?.focus();
      } else if (isPlainKey(event, "Enter") && activeRef.current !== null && nothingFocused()) {
        event.preventDefault();
        links()[activeRef.current]?.click();
      } else if (isAnyPlainKey(event, IN_KEYS) && activeRef.current !== null && arrowsNavigate()) {
        const link = links()[activeRef.current];
        const focused = document.activeElement;
        if (!link || (focused !== link && !nothingFocused())) return;
        event.preventDefault();
        link.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count]);

  const rowProps = (index: number): RowProps => {
    const on = index === active;
    return {
      "data-row": "",
      "data-active": on ? "" : undefined,
      prefetch: on ? null : false,
      onMouseMove: on ? undefined : () => highlight(index),
      onFocus: () => highlight(index),
    };
  };

  return { navRef, active, rowProps };
}
