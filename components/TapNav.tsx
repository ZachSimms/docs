/**
 * @file Touch shortcuts: double-tap the left or right edge of the screen to act
 * like `←` and `→`.
 *
 * Client component mounted once in the root layout. Only touch pointers count
 * (mouse and pen are left alone), and only double taps in the outer quarters
 * of the screen (`lib/gestures.ts`).
 * - The left edge goes up a level by clicking the pinned `../`, so the parent
 *   list highlights the row you left, as with `←`.
 * - The right edge opens the page list's highlighted row, as with `→`, and does
 *   nothing when no row is highlighted.
 *
 * Taps on interactive elements, inside boxes that scroll sideways (code,
 * tables, diagrams), with text selected, or that start while search or the
 * contents menu is open are ignored. The edges are measured against the
 * visible area, so they stay at the screen's edges while pinch-zoomed. A `<` or `>` flashes at the edge when a gesture acts.
 */

"use client";

import { useEffect, useState } from "react";
import { isDoubleTap, isTap, tapZone, type Tap, type TapPoint, type Zone } from "@/lib/gestures";
import { isOverlayOpen } from "@/lib/keys";

/** How long the edge glyph shows (ms); the CSS fade matches it. */
export const FLASH_MS = 400;

/**
 * Where taps belong to the element, never to the gesture: interactive
 * elements, and boxes that may scroll sideways (code, tables, diagrams).
 */
const IGNORED =
  "a, button, input, textarea, select, summary, label, iframe, [role=tab], [contenteditable], .toc-menu, pre, table, .diagram";

/** Whether a tap on `target` should be left alone (also while text is selected). */
function ignored(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || target.closest(IGNORED)) return true;
  return !(window.getSelection()?.isCollapsed ?? true);
}

/**
 * Edge gestures are off inside the playground's reference panel (`<html data-embed>`)
 * and on pages that opt out with `data-no-tap-nav` (the playground, where a double tap
 * near the edge while editing must never navigate away).
 */
function gesturesOff(): boolean {
  return (
    document.documentElement.hasAttribute("data-embed") ||
    document.querySelector("[data-no-tap-nav]") !== null
  );
}

/** Act on a double tap in `zone`; returns whether anything happened. */
function act(zone: Zone): boolean {
  if (isOverlayOpen() || gesturesOff()) return false;
  const link =
    zone === "left"
      ? document.querySelector<HTMLAnchorElement>(".back-rail a")
      : document
          .querySelector("nav[data-menu]")
          ?.querySelector<HTMLAnchorElement>("a[data-active]");
  link?.click();
  return Boolean(link);
}

/** The edge glyph currently showing, keyed so a repeat restarts its fade. */
interface Flash {
  readonly zone: Zone;
  readonly key: number;
}

/** Listen for edge double taps and render the brief `<` / `>` feedback. */
export function TapNav() {
  const [flash, setFlash] = useState<Flash | null>(null);

  useEffect(() => {
    let down: TapPoint | null = null;
    let last: Tap | null = null;

    // Positions are taken relative to the visible area, so the edges are where the reader
    // sees them even while pinch-zoomed (clientX is relative to the whole layout viewport).
    const point = (event: PointerEvent): TapPoint => ({
      x: event.clientX - (window.visualViewport?.offsetLeft ?? 0),
      y: event.clientY,
      t: event.timeStamp,
    });
    const onDown = (event: PointerEvent) => {
      // A touch that starts over an open overlay (search, the contents menu) belongs to it:
      // the tap that closes the menu must not become the first half of a double tap.
      if (isOverlayOpen()) {
        down = null;
        last = null;
        return;
      }
      down = event.pointerType === "touch" && event.isPrimary ? point(event) : null;
    };
    const onCancel = () => {
      down = null;
      last = null;
    };
    const onUp = (event: PointerEvent) => {
      const start = down;
      down = null;
      if (event.pointerType !== "touch" || !start) return;
      const up = point(event);
      const zone = tapZone(up.x, window.visualViewport?.width ?? window.innerWidth);
      if (!zone || !isTap(start, up) || ignored(event.target)) {
        last = null;
        return;
      }
      const tap: Tap = { ...up, zone };
      if (last && isDoubleTap(last, tap)) {
        last = null;
        if (act(zone)) setFlash({ zone, key: tap.t });
      } else {
        last = tap;
      }
    };

    // Capture phase: runs before an overlay's own outside-press handler closes it (the
    // browser flushes React's update between listeners), so `isOverlayOpen()` still sees it.
    const options = { capture: true, passive: true } as const;
    window.addEventListener("pointerdown", onDown, options);
    window.addEventListener("pointerup", onUp, options);
    window.addEventListener("pointercancel", onCancel, options);
    return () => {
      window.removeEventListener("pointerdown", onDown, options);
      window.removeEventListener("pointerup", onUp, options);
      window.removeEventListener("pointercancel", onCancel, options);
    };
  }, []);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), FLASH_MS);
    return () => clearTimeout(timer);
  }, [flash]);

  if (!flash) return null;
  return (
    <div key={flash.key} className={`tap-flash tap-flash-${flash.zone}`} aria-hidden="true">
      {flash.zone === "left" ? "<" : ">"}
    </div>
  );
}
