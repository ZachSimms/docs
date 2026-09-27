/**
 * @file Ordered dithering and value noise: the pieces the home page's moon and sun are
 * drawn with (see `lib/sky.ts`). Any grid of ink amounts becomes one bit per cell with
 * an 8×8 Bayer matrix; the noise gives surfaces texture.
 *
 * Pure and deterministic (no DOM), so every drawing is repeatable and tested directly.
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
 * Reduce a grid of ink amounts to one bit per cell with the Bayer thresholds.
 *
 * @param ink - Row by row, 0 (no ink) to 1 (solid), `columns × rows` values.
 * @returns 1 where the cell is inked.
 */
export function ditherBits(ink: ArrayLike<number>, columns: number, rows: number): Uint8Array {
  const bits = new Uint8Array(columns * rows);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const i = y * columns + x;
      bits[i] = ink[i]! > bayerThreshold(x, y) ? 1 : 0;
    }
  }
  return bits;
}
