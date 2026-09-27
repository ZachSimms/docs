/**
 * @file The numbered link list used on the home page, topic pages and `/sheets/`.
 *
 * Client component: besides rendering the list it makes it a keyboard/mouse
 * menu. `↓`/`j` and `↑`/`k` move a highlight (wrapping, and repeating while
 * held) and focus the row, `Enter`, `→` or `l` opens it (into a directory or a
 * sheet), and moving the mouse over a row or focusing it moves the same
 * highlight. After going up a level (`ParentLink`), the row for the page just
 * left starts highlighted, so `→` goes straight back in. The highlighted row gets `data-active`
 * on its number and link; the CSS draws a `>` marker in the gutter and a solid
 * underline. Only the first list on a page listens to the keyboard.
 */

"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { BreakablePath } from "@/components/BreakablePath";
import { padNumber } from "@/lib/format";
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
import { DottedLink } from "./DottedLink";

/** One row of a {@link NumberedList}. */
export interface NumberedItem {
  /** Non-negative integer shown zero-padded, e.g. `8` renders as `08.`. */
  readonly number: number;
  /** Link destination; also used as the React key, so it must be unique per list. */
  readonly href: string;
  /** Link text. */
  readonly label: string;
}

/** Keys that move the highlight, mapped to their direction. */
const MOVES: Readonly<Record<string, 1 | -1>> = { ArrowDown: 1, j: 1, ArrowUp: -1, k: -1 };

/** The direction a key moves the highlight, or `undefined` if it is not a menu key. */
function moveFor(event: KeyLike): 1 | -1 | undefined {
  const delta = MOVES[event.key];
  return delta !== undefined && isPlainKey(event, event.key, { allowRepeat: true })
    ? delta
    : undefined;
}

/** Index of the row leading back to the page just left by going up, or `null`. */
function cameFromIndex(items: readonly NumberedItem[]): number | null {
  const from = peekCameFrom();
  const index = from === null ? -1 : items.findIndex((item) => item.href === from);
  return index === -1 ? null : index;
}

/** Whether no element has keyboard focus (so a bare `Enter` belongs to the menu). */
function nothingFocused(): boolean {
  const focused = document.activeElement;
  return focused === null || focused === document.body;
}

/**
 * Render `<nav><span>NN.</span>&nbsp;<a><i>label</i></a><br>…</nav>`, the
 * markup of the original site except for the no-break space and the `<wbr>`
 * break points after slashes, which keep a long path beside its number on phones.
 * The nav carries `data-menu` so the first list on a page can be found.
 *
 * `Enter` only opens the highlighted row when nothing else has focus; with a
 * row focused the browser follows the link itself, and with another control
 * focused (a button, the footer, a tab) the keystroke is left alone.
 * Highlighting follows `mousemove`, not `mouseenter`, so rows sliding under a
 * still pointer while the page scrolls do not steal the highlight.
 *
 * @param props.items - Rows in display order; an empty list renders an empty `<nav>`.
 */
export function NumberedList({ items }: { items: readonly NumberedItem[] }) {
  // A client-side mount after going up starts on the row we came from; a full
  // page load has nothing remembered, so hydration matches the server's markup.
  const [active, setActive] = useState<number | null>(() => cameFromIndex(items));
  const activeRef = useRef<number | null>(active);
  const navRef = useRef<HTMLElement>(null);
  const count = items.length;

  /** Update the highlight for rendering and for the (registered-once) key handler. */
  const highlight = (index: number) => {
    activeRef.current = index;
    setActive(index);
  };

  useEffect(() => forgetCameFrom(), []);

  useEffect(() => {
    const nav = navRef.current;
    const links = () => [...(nav?.querySelectorAll<HTMLAnchorElement>(":scope > a") ?? [])];

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

  return (
    <nav ref={navRef} data-menu="">
      {items.map((item, i) => {
        const on = i === active ? "" : undefined;
        return (
          <Fragment key={item.href}>
            {/* A no-break space keeps the label on the number's line; it wraps at its slashes. */}
            <span data-active={on}>{padNumber(item.number)}.</span>{"\u00a0"}
            <DottedLink
              href={item.href}
              // Only the highlighted row (hovered, chosen with the keys, or the page just left)
              // prefetches: a sheet's payload averages ~200 KB, and /sheets/ lists ~180 of them.
              prefetch={i === active ? null : false}
              data-active={on}
              onMouseMove={i === active ? undefined : () => highlight(i)}
              onFocus={() => highlight(i)}
            >
              <BreakablePath label={item.label} />
            </DottedLink>
            <br />
          </Fragment>
        );
      })}
    </nav>
  );
}
