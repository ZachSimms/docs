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
 * tables, diagrams), with text selected or while search or the contents menu
 * is open are ignored. A `<` or `>` flashes at the edge when a gesture acts.
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

/** Act on a double tap in `zone`; returns whether anything happened. */
function act(zone: Zone): boolean {
  if (isOverlayOpen()) return false;
  const link =
    zone === "left"
      ? document.querySelector<HTMLAnchorElement>(".back-rail a")
      : document.querySelector("nav[data-menu]")?.querySelector<HTMLAnchorElement>("a[data-active]");
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

    const point = (event: PointerEvent): TapPoint => ({
      x: event.clientX,
      y: event.clientY,
      t: event.timeStamp,
    });
    const onDown = (event: PointerEvent) => {
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
      const zone = tapZone(up.x, window.innerWidth);
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

    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onCancel, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
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
