/**
 * @file A drag handle on the edge of a playground pane.
 *
 * Client component. `role="separator"` with the size as its value: drag it
 * (pointer capture, so the pointer can leave the handle), or focus it and use
 * the arrow keys (Shift for bigger steps), Home/End for the limits, and
 * Enter or double-click to go back to the default size. The handle sits on
 * one `edge` of its pane, which decides which way a drag grows it.
 */

"use client";

import type { KeyboardEvent, PointerEvent } from "react";
import { clampSize, LAYOUT_BOUNDS, type LayoutPart } from "@/lib/playground/layout";

/** Which edge of its pane the handle sits on. */
export type SplitterEdge = "left" | "right" | "top" | "bottom";

/** Keyboard steps in pixels. */
export const SPLITTER_STEP = { small: 16, big: 64 } as const;

/** Props for {@link Splitter}. */
interface SplitterProps {
  part: LayoutPart;
  size: number;
  edge: SplitterEdge;
  onSize(size: number): void;
}

/** +1 when moving the pointer or key in the positive axis direction grows the pane. */
const GROWS: Readonly<Record<SplitterEdge, 1 | -1>> = { right: 1, bottom: 1, left: -1, top: -1 };

/**
 * The size a key press asks for, or `null` for keys the handle ignores.
 *
 * @param key - `KeyboardEvent.key`.
 * @param shift - Whether Shift was held (bigger steps).
 */
export function sizeForKey(
  part: LayoutPart,
  size: number,
  edge: SplitterEdge,
  key: string,
  shift: boolean,
): number | null {
  const bounds = LAYOUT_BOUNDS[part];
  const step = shift ? SPLITTER_STEP.big : SPLITTER_STEP.small;
  const axisKeys = bounds.axis === "x" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
  if (key === "Home") return bounds.min;
  if (key === "End") return bounds.max;
  if (key === "Enter") return bounds.initial;
  const index = axisKeys.indexOf(key);
  if (index === -1) return null;
  const direction = index === 0 ? -1 : 1;
  return clampSize(part, size + direction * GROWS[edge] * step);
}

/** Render the handle. */
export function Splitter({ part, size, edge, onSize }: SplitterProps) {
  const bounds = LAYOUT_BOUNDS[part];

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const handle = event.currentTarget;
    const start = bounds.axis === "x" ? event.clientX : event.clientY;
    const startSize = size;
    handle.setPointerCapture(event.pointerId);
    handle.dataset.dragging = "";
    const onMove = (move: globalThis.PointerEvent) => {
      const now = bounds.axis === "x" ? move.clientX : move.clientY;
      onSize(clampSize(part, startSize + (now - start) * GROWS[edge]));
    };
    const onUp = () => {
      delete handle.dataset.dragging;
      handle.removeEventListener("pointermove", onMove);
      handle.removeEventListener("pointerup", onUp);
      handle.removeEventListener("pointercancel", onUp);
    };
    handle.addEventListener("pointermove", onMove);
    handle.addEventListener("pointerup", onUp);
    handle.addEventListener("pointercancel", onUp);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = sizeForKey(part, size, edge, event.key, event.shiftKey);
    if (next === null) return;
    event.preventDefault();
    onSize(next);
  };

  return (
    <div
      className="pg-splitter"
      data-edge={edge}
      role="separator"
      aria-orientation={bounds.axis === "x" ? "vertical" : "horizontal"}
      aria-label={`Resize ${bounds.label}`}
      aria-valuenow={size}
      aria-valuemin={bounds.min}
      aria-valuemax={bounds.max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={() => onSize(bounds.initial)}
    />
  );
}
