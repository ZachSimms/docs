/**
 * @file The home page's dither block: a soft noise field, lighter at the top and denser
 * at the bottom, reduced to one bit per cell with an 8×8 Bayer ordered dither.
 *
 * Pure and deterministic (no DOM), so the pattern is the same on every load and the
 * math is tested directly; `components/DitherBlock.tsx` draws the mask on a canvas.
 */

/** The 8×8 Bayer matrix: thresholds 0–63 laid out so neighbors differ as much as possible. */
export const BAYER_8: readonly number[] = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7,
  39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];

/** The threshold (0 to 1, exclusive) a value must exceed to light cell `(x, y)`. */
export function bayerThreshold(x: number, y: number): number {
  return (BAYER_8[(y % 8) * 8 + (x % 8)]! + 0.5) / 64;
}

/** A repeatable pseudo-random value in [0, 1) for an integer lattice point. */
function lattice(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 374_761_393) ^ Math.imul(y, 668_265_263) ^ Math.imul(seed, 1_274_126_177);
  h = Math.imul(h ^ (h >>> 13), 1_103_515_245);
  return ((h ^ (h >>> 16)) >>> 0) / 4_294_967_296;
}

/** Smoothstep easing, so the noise has no visible grid seams. */
function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Value noise in [0, 1): lattice values blended smoothly between integer points. */
export function valueNoise(x: number, y: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const sx = smooth(x - x0);
  const sy = smooth(y - y0);
  const top = lattice(x0, y0, seed) * (1 - sx) + lattice(x0 + 1, y0, seed) * sx;
  const bottom = lattice(x0, y0 + 1, seed) * (1 - sx) + lattice(x0 + 1, y0 + 1, seed) * sx;
  return top * (1 - sy) + bottom * sy;
}

/** Four octaves of value noise, normalized back into [0, 1). */
export function fractalNoise(x: number, y: number, seed: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let total = 0;
  for (let octave = 0; octave < 4; octave++) {
    sum += amplitude * valueNoise(x * frequency, y * frequency, seed + octave);
    total += amplitude;
    amplitude /= 2;
    frequency *= 2;
  }
  return sum / total;
}

/**
 * The field's brightness at a point of the block, from 0 (empty) to 1 (solid).
 *
 * @param u - Across the block, 0 at the left to 1 at the right.
 * @param v - Down the block, 0 at the top to 1 at the bottom.
 * @param time - Drift, in arbitrary units; 0 for the still pattern.
 * @param seed - Picks the pattern.
 */
export function ditherField(u: number, v: number, time: number, seed: number): number {
  const clouds = fractalNoise(u * 6 + time, v * 2.2 - time * 0.35, seed);
  // Fade in over the top quarter, so the block emerges from the page instead of starting on a cut edge.
  const fade = Math.min(1, 0.1 + v / 0.28);
  const value = ((clouds - 0.5) * 1.1 + v * 0.9 - 0.05) * fade;
  return Math.min(1, Math.max(0, value));
}

/**
 * The block as one bit per cell, row by row: 1 where the dithered field is lit.
 *
 * @param columns - Cells across.
 * @param rows - Cells down.
 */
export function ditherMask(columns: number, rows: number, time: number, seed: number): Uint8Array {
  const mask = new Uint8Array(columns * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const value = ditherField(x / columns, y / Math.max(1, rows - 1), time, seed);
      mask[y * columns + x] = value > bayerThreshold(x, y) ? 1 : 0;
    }
  }
  return mask;
}
