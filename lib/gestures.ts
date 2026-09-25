/**
 * @file Pure touch-gesture helpers for `components/TapNav.tsx`: which edge a
 * tap is on, what counts as a tap, and when two taps make a double tap.
 */

/** An edge of the screen that answers double taps. */
export type Zone = "left" | "right";

/** A touch position (CSS px) and time (ms). */
export interface TapPoint {
  readonly x: number;
  readonly y: number;
  readonly t: number;
}

/** A completed tap and the zone it landed in. */
export interface Tap extends TapPoint {
  readonly zone: Zone;
}

/** Share of the screen width, on each side, that counts as an edge. */
export const EDGE_FRACTION = 0.25;
/** A touch that moves further than this (px) is a scroll, not a tap. */
export const TAP_MAX_MOVE = 10;
/** A touch held longer than this (ms) is a long press, not a tap. */
export const TAP_MAX_MS = 300;
/** Two taps further apart in time than this (ms) are separate taps. */
export const DOUBLE_MAX_MS = 300;
/** Two taps further apart in space than this (px) are separate taps. */
export const DOUBLE_MAX_DISTANCE = 40;

/**
 * The edge a tap at `x` is on.
 *
 * @param x - Horizontal position in CSS px.
 * @param width - Viewport width in CSS px.
 * @returns `"left"` or `"right"` in the outer quarters, `null` in the middle half.
 */
export function tapZone(x: number, width: number): Zone | null {
  if (x < width * EDGE_FRACTION) return "left";
  if (x > width * (1 - EDGE_FRACTION)) return "right";
  return null;
}

/**
 * Whether a touch from `down` to `up` was a tap: short and nearly still.
 *
 * @param down - Where and when the finger touched.
 * @param up - Where and when it lifted.
 */
export function isTap(down: TapPoint, up: TapPoint): boolean {
  return (
    Math.hypot(up.x - down.x, up.y - down.y) <= TAP_MAX_MOVE && up.t - down.t <= TAP_MAX_MS
  );
}

/**
 * Whether `second` completes a double tap started by `first`: same zone,
 * soon after and close by.
 *
 * @param first - The earlier tap.
 * @param second - The later tap.
 */
export function isDoubleTap(first: Tap, second: Tap): boolean {
  return (
    first.zone === second.zone &&
    second.t - first.t <= DOUBLE_MAX_MS &&
    Math.hypot(second.x - first.x, second.y - first.y) <= DOUBLE_MAX_DISTANCE
  );
}
