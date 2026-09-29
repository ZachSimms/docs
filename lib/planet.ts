/**
 * @file The home page's planet: a ringed planet of glassy dark glass and streaked light,
 * turning, drawn as ink per cell and dithered (see `lib/dither.ts`).
 *
 * Pure (no DOM). The scene is cast one ray per sample, straight into the picture: a
 * sphere of radius 1 at the center, and a flat ring round it whose long axis rises
 * {@link TILT} to the right and which is opened {@link OPENING} from edge-on, so the
 * north pole tips toward the reader. The rings are made of thin ringlets broken into
 * streaks; each ringlet turns at its own Keplerian rate (inner ones faster), so the
 * streaks shear past each other. The globe is dark but for streaked bands between its
 * equator and a dark polar cap, bands that turn with it, and a faint rim.
 *
 * The streaks are looked up in tables built once, from noise laid round a circle so
 * they wrap without a seam; a frame then costs a few lookups per sample.
 */

import { ditherBits, fractalNoise3, valueNoise } from "./dither";

/** Degrees to radians. */
const DEG = Math.PI / 180;

/** How far the rings' long axis rises to the right, in the picture. */
export const TILT = 20 * DEG;
/** How far the rings are opened from edge-on: the north pole tips toward the reader this much. */
export const OPENING = 14 * DEG;
/** The rings' inner and outer edges, in planet radii. */
export const RING_INNER = 1.12;
export const RING_OUTER = 1.97;
/** Latitude where the dark polar cap begins. */
const CAP = 47 * DEG;
/** Seconds for the outermost ringlet to go once round; inner ones are faster (Kepler). */
const RING_PERIOD = 60;
/** Seconds for the ringlet at `radius` to go once round: Kepler's third law, T ∝ r^1.5. */
export function ringletPeriod(radius: number): number {
  return RING_PERIOD * (radius / RING_OUTER) ** 1.5;
}
/** Seconds for the globe to turn once. */
const GLOBE_PERIOD = 30;

/** A direction in the picture's frame: x right, y down, z toward the reader. */
interface Vector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** The planet's north pole: up and left, tipped toward the reader. */
const NORTH: Vector = {
  x: -Math.cos(OPENING) * Math.sin(TILT),
  y: -Math.cos(OPENING) * Math.cos(TILT),
  z: Math.sin(OPENING),
};
/** Along the rings' long axis, to the right. */
const ACROSS: Vector = { x: Math.cos(TILT), y: -Math.sin(TILT), z: 0 };
/** In the ring plane, toward the reader (and down the picture). */
const FRONT: Vector = {
  x: Math.sin(TILT) * Math.sin(OPENING),
  y: Math.cos(TILT) * Math.sin(OPENING),
  z: Math.cos(OPENING),
};

/** The dot product of a point `(x, y, z)` with a direction. */
function dot(x: number, y: number, z: number, v: Vector): number {
  return x * v.x + y * v.y + z * v.z;
}

/**
 * Longitude about the north pole, from the right-hand end of the rings round behind the
 * planet; as it grows, a marking on the near side travels from left to right.
 */
function longitude(x: number, y: number, z: number): number {
  return Math.atan2(-dot(x, y, z, FRONT), dot(x, y, z, ACROSS));
}

/** Linear ramp between two edges, clamped to [0, 1]. */
function ramp(value: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

/** Samples round a circle in the streak tables. */
const AROUND = 512;
/** Samples across the rings (inner edge to outer) and up the bands (equator to cap). */
const ACROSS_RINGS = 96;
const UP_BANDS = 48;

/**
 * Streaks round a circle: bright dashes with dim breaks, in [0.25, 1]. `band` picks
 * which ringlet or band, so neighbors break in different places.
 */
function streak(angle: number, band: number, seed: number): number {
  const n = fractalNoise3(Math.cos(angle) * 4, Math.sin(angle) * 4, band, seed);
  return 0.25 + 0.75 * ramp(n, 0.34, 0.6);
}

/** Brightness across the rings, `s` from 0 (inner edge) to 1 (outer): ringlets and gaps. */
function ringlets(s: number): number {
  const lines = ramp(valueNoise(s * 34, 0.5, 3), 0.36, 0.7);
  const envelope = 0.45 + 0.55 * ramp(s, 0, 0.45);
  const division = ramp(Math.abs(s - 0.64), 0.015, 0.04);
  return lines * envelope * (0.15 + 0.85 * division);
}

/**
 * Brightness of the globe's bands, from the equator (0) up to the cap: nothing in the
 * low latitudes, rising to the brightest at the cap's edge.
 */
function bands(latitude: number): number {
  const lines = ramp(valueNoise((latitude / CAP) * 18, 1.5, 7), 0.3, 0.66);
  return lines * ramp(latitude, 14 * DEG, CAP - 4 * DEG);
}

/** A table of `rows × AROUND` brightnesses: a profile across the rows, streaked round. */
function streakTable(rows: number, profile: (t: number) => number, seed: number): Float32Array {
  const table = new Float32Array(rows * AROUND);
  for (let row = 0; row < rows; row++) {
    const t = (row + 0.5) / rows;
    const brightness = profile(t);
    for (let i = 0; i < AROUND; i++) {
      table[row * AROUND + i] = brightness * streak((i / AROUND) * 2 * Math.PI, t * 34, seed);
    }
  }
  return table;
}

/** The two tables, built on first use. */
let tables: { rings: Float32Array; bands: Float32Array } | null = null;

function streakTables(): { rings: Float32Array; bands: Float32Array } {
  tables ??= {
    rings: streakTable(ACROSS_RINGS, ringlets, 5),
    bands: streakTable(UP_BANDS, (t) => bands(t * CAP), 9),
  };
  return tables;
}

/** Index round a table's circle for an angle, wrapping either way. */
function around(angle: number): number {
  const i = Math.floor((angle / (2 * Math.PI)) * AROUND) % AROUND;
  return i < 0 ? i + AROUND : i;
}

/** Half the picture's width and height taken up by the planet, in planet radii. */
export const EXTENT = {
  x: Math.hypot(RING_OUTER * Math.cos(TILT), RING_OUTER * Math.sin(OPENING) * Math.sin(TILT)),
  y: 1,
} as const;

/** Ink at one point of the picture, in planet radii from the center, at `time` seconds. */
function inkAt(x: number, y: number, time: number): number {
  const { rings, bands: globe } = streakTables();
  const r2 = x * x + y * y;
  const globeDepth = r2 < 1 ? Math.sqrt(1 - r2) : -Infinity;

  // Where the ray meets the ring plane, and whether the ring is there and in front.
  const z = -(x * NORTH.x + y * NORTH.y) / NORTH.z;
  const radius = Math.sqrt(r2 + z * z);
  if (radius >= RING_INNER && radius <= RING_OUTER && z > globeDepth) {
    const s = (radius - RING_INNER) / (RING_OUTER - RING_INNER);
    const row = Math.min(ACROSS_RINGS - 1, Math.floor(s * ACROSS_RINGS));
    const turned = ((2 * Math.PI) / ringletPeriod(radius)) * time;
    return rings[row * AROUND + around(longitude(x, y, z) - turned)]!;
  }
  if (r2 >= 1) return 0;

  // Glass: dark face on, lit toward the edge (a Fresnel sheen), with a faint rim.
  const depth = globeDepth;
  const sheen = 0.55 + 0.45 * (1 - depth);
  const rim = 0.3 * ramp(Math.sqrt(r2), 0.93, 1);
  const latitude = Math.asin(Math.min(1, dot(x, y, depth, NORTH)));
  if (latitude <= 0 || latitude >= CAP) return rim;
  const row = Math.min(UP_BANDS - 1, Math.floor((latitude / CAP) * UP_BANDS));
  const turned = ((2 * Math.PI) / GLOBE_PERIOD) * time;
  return Math.max(rim, sheen * globe[row * AROUND + around(longitude(x, y, depth) - turned)]!);
}

/**
 * Ink below the first amount is dropped and above the second is solid, so bright streaks
 * dither to unbroken lines and only their fading ends and the glass are stippled.
 */
const CONTRAST = [0.1, 0.62] as const;

/** Samples per cell edge: each cell's ink is the mean of this many squared, against moiré. */
const SUPERSAMPLE = 2;

/**
 * The planet as `columns × rows` ink amounts at `time` seconds, 0 (none) to 1 (solid),
 * row by row, scaled to fit with a cell to spare at the edges.
 */
export function planetInk(columns: number, rows: number, time = 0): Float32Array {
  const scale = Math.min((columns / 2 - 1) / EXTENT.x, (rows / 2 - 1) / EXTENT.y);
  const ink = new Float32Array(columns * rows);
  const step = 1 / SUPERSAMPLE;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let sum = 0;
      for (let v = 0; v < SUPERSAMPLE; v++) {
        for (let u = 0; u < SUPERSAMPLE; u++) {
          const x = (column + (u + 0.5) * step - columns / 2) / scale;
          const y = (row + (v + 0.5) * step - rows / 2) / scale;
          sum += inkAt(x, y, time);
        }
      }
      ink[row * columns + column] = ramp(sum / SUPERSAMPLE ** 2, CONTRAST[0], CONTRAST[1]);
    }
  }
  return ink;
}

/** The planet as `columns × rows` cells at `time` seconds, 1 where the cell is inked. */
export function planetBits(columns: number, rows: number, time = 0): Uint8Array {
  return ditherBits(planetInk(columns, rows, time), columns, rows);
}
