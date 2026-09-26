/**
 * @file The getting-started tour: coach marks on the real controls.
 *
 * Client component. Each step outlines its target (found by selector) and
 * shows a card next to it; on phones the card is a bottom sheet and the step
 * switches to the pane that holds the target. → or Enter: next, ←: back,
 * Esc: skip. Steps whose target isn't on screen are skipped over.
 */

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { TOUR_STEPS, type TourStep } from "@/lib/playground/shortcuts";

/** Props for {@link Tour}. */
interface TourProps {
  /** Show the pane a step needs (phones). */
  onPane(pane: TourStep["pane"]): void;
  /** The tour ended (finished or skipped). */
  onDone(): void;
}

/** The target's box, or `null` when it isn't rendered or visible. */
function targetRect(step: TourStep): DOMRect | null {
  // The first visible match: some targets exist twice (toolbar on desktop, tab bar on phones).
  for (const el of document.querySelectorAll(step.target)) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  return null;
}

/** Space kept between the card, its target and the viewport edges. */
const GAP = 12;

/**
 * Where the card goes: below the target if it fits, else above, else beside
 * it (right, then left), else centered. Pure, for tests.
 *
 * @returns The card's top-left corner in viewport pixels.
 */
export function placeCard(
  target: { top: number; bottom: number; left: number; right: number },
  card: { width: number; height: number },
  viewport: { width: number; height: number },
): { left: number; top: number } {
  const clampX = (x: number) => Math.min(Math.max(8, x), viewport.width - card.width - 8);
  const clampY = (y: number) => Math.min(Math.max(8, y), viewport.height - card.height - 8);
  if (target.bottom + GAP + card.height <= viewport.height)
    return { left: clampX(target.left), top: target.bottom + GAP };
  if (target.top - GAP - card.height >= 0)
    return { left: clampX(target.left), top: target.top - GAP - card.height };
  if (target.right + GAP + card.width <= viewport.width)
    return { left: target.right + GAP, top: clampY(target.top + GAP) };
  if (target.left - GAP - card.width >= 0)
    return { left: target.left - GAP - card.width, top: clampY(target.top + GAP) };
  return {
    left: clampX((viewport.width - card.width) / 2),
    top: clampY((viewport.height - card.height) / 2),
  };
}

/** Render the current step. */
export function Tour({ onPane, onDone }: TourProps) {
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const step = TOUR_STEPS[index]!;

  // Switch pane for the step, then measure its target once the layout has settled.
  useLayoutEffect(() => {
    onPane(step.pane);
    const measure = () => setRect(targetRect(step));
    const frame = requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
    };
  }, [step, onPane]);

  // Place the card once its size is known.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el || !rect) return setPosition(null);
    const { width, height } = el.getBoundingClientRect();
    setPosition(
      placeCard(rect, { width, height }, { width: window.innerWidth, height: window.innerHeight }),
    );
  }, [rect]);

  useEffect(() => {
    card.current?.focus();
  }, [index]);

  const go = useCallback(
    (delta: 1 | -1) => {
      const next = index + delta;
      if (next < 0) return;
      if (next >= TOUR_STEPS.length) onDone();
      else setIndex(next);
    },
    [index, onDone],
  );

  return (
    <div className="pg-tour" data-step={step.id}>
      {rect && (
        <div
          className="pg-tour-mark"
          aria-hidden="true"
          style={{
            left: rect.left - 4,
            top: rect.top - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      )}
      <div
        ref={card}
        className="pg-tour-card"
        role="dialog"
        aria-modal="false"
        aria-labelledby="pg-tour-title"
        aria-describedby="pg-tour-body"
        tabIndex={-1}
        style={position ?? undefined}
        onKeyDown={(event) => {
          const keys: Record<string, () => void> = {
            ArrowRight: () => go(1),
            Enter: () => go(1),
            ArrowLeft: () => go(-1),
            Escape: onDone,
          };
          const action = keys[event.key];
          if (!action) return;
          event.preventDefault();
          event.stopPropagation();
          action();
        }}
      >
        <p className="pg-muted">
          {index + 1} / {TOUR_STEPS.length}
        </p>
        <h2 id="pg-tour-title">{step.title}</h2>
        <p id="pg-tour-body">{step.body}</p>
        <p className="pg-tour-actions">
          <button type="button" className="link" onClick={onDone}>
            <i>skip</i>
          </button>
          <span>
            {index > 0 && (
              <button type="button" className="link" onClick={() => go(-1)}>
                <i>← back</i>
              </button>
            )}{" "}
            <button type="button" className="link" onClick={() => go(1)}>
              <i>{index === TOUR_STEPS.length - 1 ? "done" : "next →"}</i>
            </button>
          </span>
        </p>
      </div>
    </div>
  );
}
