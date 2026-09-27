/**
 * @file The home page's sky: tonight's moon (light theme) and the sun (dark theme), as
 * dithered drawings with a caption.
 *
 * Pure (no DOM). The moon's phase comes from the mean synodic month counted from a known
 * new moon, good to within about half a day; the equinoxes and solstices from Meeus'
 * mean formulas (Astronomical Algorithms, ch. 27), good to within an hour for this
 * millennium. The drawings return one bit per cell, 1 where the cell is inked in the
 * text color: the moon's shadow is dense and its lit face sparse, the sun's light dense.
 */

import { ditherBits, fractalNoise } from "./dither";

/** Mean length of a lunar month (new moon to new moon), in days. */
export const SYNODIC_MONTH = 29.530588853;

/** A known new moon: 2000-01-06 18:14 UTC. */
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

/** Milliseconds in a day. */
const DAY = 86_400_000;

/** The eight phase names, from new moon round to waning crescent. */
export const PHASE_NAMES = [
  "new moon",
  "waxing crescent",
  "first quarter",
  "waxing gibbous",
  "full moon",
  "waning gibbous",
  "last quarter",
  "waning crescent",
] as const;

/** The moon at a moment. */
export interface MoonPhase {
  /** Fraction of the lunar month since new moon, 0 to 1. */
  readonly age: number;
  /** Fraction of the disc lit, 0 to 1. */
  readonly illumination: number;
  readonly name: (typeof PHASE_NAMES)[number];
}

/** The moon's phase at `date`. */
export function moonPhase(date: Date): MoonPhase {
  const days = (date.getTime() - REFERENCE_NEW_MOON) / DAY;
  const age = (((days / SYNODIC_MONTH) % 1) + 1) % 1;
  const illumination = (1 - Math.cos(age * 2 * Math.PI)) / 2;
  const name = PHASE_NAMES[Math.floor(age * 8 + 0.5) % 8]!;
  return { age, illumination, name };
}

/** An equinox or solstice. */
export interface SeasonEvent {
  readonly name: "spring equinox" | "summer solstice" | "autumn equinox" | "winter solstice";
  readonly date: Date;
}

/** Meeus' mean JDE0 polynomials in Y = (year − 2000) / 1000, for March, June, September, December. */
const SEASON_TERMS = [
  ["spring equinox", [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057]],
  ["summer solstice", [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.0003]],
  ["autumn equinox", [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078]],
  ["winter solstice", [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032]],
] as const;

/** The four equinoxes and solstices of a year (northern-hemisphere names), in order. */
export function seasonEvents(year: number): SeasonEvent[] {
  const y = (year - 2000) / 1000;
  return SEASON_TERMS.map(([name, [a, b, c, d, e]]) => {
    const jde = a + b * y + c * y ** 2 + d * y ** 3 + e * y ** 4;
    return { name, date: new Date((jde - 2440587.5) * DAY) };
  });
}

/** Midnight of `date`'s calendar day in the local time zone, as a day count. */
function localDay(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY;
}

/**
 * The next equinox or solstice from `date`, and whole days until it on the reader's own
 * calendar (0 when it falls today).
 */
export function nextSeasonEvent(date: Date): SeasonEvent & { readonly days: number } {
  const year = date.getFullYear();
  const next = [...seasonEvents(year - 1), ...seasonEvents(year), ...seasonEvents(year + 1)].find(
    (event) => localDay(event.date) >= localDay(date),
  )!;
  return { ...next, days: localDay(next.date) - localDay(date) };
}

/** A crater on the moon's face: center and radius in disc units (the disc is radius 1). */
interface Crater {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** Craters outlined on the lit face. */
const CRATERS: readonly Crater[] = [
  { x: 0.26, y: -0.55, r: 0.1 },
  { x: -0.38, y: 0.46, r: 0.12 },
  { x: -0.12, y: -0.12, r: 0.05 },
  { x: 0.45, y: 0.3, r: 0.07 },
];

/** Linear ramp between two edges, clamped to [0, 1]. */
function ramp(value: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

/**
 * Tonight's moon as `size × size` cells: the disc outlined, its shadow densely inked,
 * its lit face sparse with darker seas and outlined craters.
 *
 * @param age - Fraction of the lunar month since new moon (see {@link moonPhase}).
 */
export function moonBits(size: number, age: number, seed = 11): Uint8Array {
  const phase = age * 2 * Math.PI;
  // Direction of the sunlight, seen from Earth: behind the moon at new, in front at full;
  // waxing lights the right-hand side, waning the left (as seen from the north).
  const light = { x: Math.sin(phase), z: -Math.cos(phase) };
  const cell = 2 / size;
  const ink = new Float32Array(size * size);

  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const x = (column + 0.5) * cell - 1;
      const y = (row + 0.5) * cell - 1;
      const r = Math.hypot(x, y);
      const i = row * size + column;
      if (r > 1) continue;
      if (r > 1 - cell * 1.2) {
        ink[i] = 1;
        continue;
      }
      const z = Math.sqrt(1 - r * r);
      const lit = ramp(x * light.x + z * light.z, -0.04, 0.12);
      const sea = ramp(fractalNoise(x * 1.8 + 4, y * 1.8 + 9, seed), 0.52, 0.64);
      const shade = 1 - lit * (1 - 0.3 * sea);
      let amount = 0.06 + 0.56 * shade;
      if (
        lit > 0.5 &&
        CRATERS.some((c) => Math.abs(Math.hypot(x - c.x, y - c.y) - c.r) < cell * 0.6)
      ) {
        amount = 1;
      }
      ink[i] = amount;
    }
  }
  return ditherBits(ink, size, size);
}

/**
 * The sun as `size × size` cells: a disc bright at the center and dimmer at the limb,
 * a few spots, and faint rays around it.
 */
export function sunBits(size: number, seed = 5): Uint8Array {
  const cell = 2 / size;
  const radius = 0.72;
  const ink = new Float32Array(size * size);

  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const x = (column + 0.5) * cell - 1;
      const y = (row + 0.5) * cell - 1;
      const r = Math.hypot(x, y);
      const i = row * size + column;
      if (r <= radius) {
        const z = Math.sqrt(1 - (r / radius) ** 2);
        const spots = ramp(fractalNoise(x * 4 + 2, y * 4 + 7, seed), 0.66, 0.74);
        ink[i] = (0.35 + 0.6 * z ** 0.6) * (1 - 0.6 * spots);
      } else if (r <= 1) {
        const rays = 0.5 + 0.5 * Math.cos(Math.atan2(y, x) * 12);
        ink[i] = 0.3 * (1 - (r - radius) / (1 - radius)) * rays;
      }
    }
  }
  return ditherBits(ink, size, size);
}
