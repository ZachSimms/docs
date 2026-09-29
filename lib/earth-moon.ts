/**
 * @file The home page's sky: the Earth turning, and the Moon going round it, drawn as
 * ink per cell and dithered (see `lib/dither.ts`).
 *
 * Pure (no DOM). One ray per sample, straight into the picture, meets two spheres: the
 * Earth (radius 1, at the center) and the Moon, and whichever is nearer is drawn, so the
 * Moon passes in front of the Earth and behind it. Both are lit by one sun, fixed in the
 * plane of the Earth's orbit (the ecliptic), which is seen {@link OPENING} from edge-on
 * and rises {@link TILT} to the right. The motion is the real one, compressed:
 *
 * - The Earth turns west to east on an axis tilted 23.4° from the ecliptic's pole;
 *   its land is Natural Earth's (see `lib/earth-map.ts`).
 * - The Moon goes round the same way, on an orbit inclined 5.1° to the ecliptic, and
 *   eccentric (0.055): by Kepler's second law it is fastest at perigee.
 * - The Moon keeps one face to the Earth, turning at a steady rate while its orbital
 *   speed varies, so it rocks a few degrees either way (libration in longitude). Its
 *   maria are placed at their real selenographic positions, roughly.
 *
 * Compressed: the Moon's distance is {@link ORBIT} Earth radii (really about 60), and
 * the Earth turns {@link MONTH} / {@link DAY} times a month (really about 27), so both
 * move at a pace the eye can follow. No eclipses: at the true distance they are rare,
 * and at this one they would come every month.
 */

import { ditherBits, fractalNoise3 } from "./dither";
import { EARTH_MAP, EARTH_MAP_COLUMNS, EARTH_MAP_ROWS } from "./earth-map";

/** Degrees to radians. */
const DEG = Math.PI / 180;

/** How far the ecliptic rises to the right, in the picture. */
export const TILT = 20 * DEG;
/** How far the ecliptic is opened from edge-on: its north pole tips toward the reader. */
export const OPENING = 14 * DEG;
/** The tilt of the Earth's axis from the ecliptic's pole (the obliquity). */
export const OBLIQUITY = 23.44 * DEG;
/** The inclination of the Moon's orbit to the ecliptic. */
export const INCLINATION = 5.14 * DEG;
/** The eccentricity of the Moon's orbit. */
export const ECCENTRICITY = 0.0549;
/** The Moon's mean distance (semi-major axis), in Earth radii: compressed from 60.3. */
export const ORBIT = 3.4;
/** The Moon's radius, in Earth radii: true to life. */
export const MOON_RADIUS = 0.2727;
/** Seconds for the Moon to go once round (a sidereal month). */
export const MONTH = 40;
/** Seconds for the Earth to turn once (a sidereal day). */
export const DAY = 13;

/** A direction or point in the picture's frame: x right, y down, z toward the reader. */
export interface Vector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

function vector(x: number, y: number, z: number): Vector {
  return { x, y, z };
}
function dot(a: Vector, b: Vector): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}
function cross(a: Vector, b: Vector): Vector {
  return vector(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}
/** `a·p`. */
function scaled(a: number, p: Vector): Vector {
  return vector(a * p.x, a * p.y, a * p.z);
}
/** `a·p + b·q`. */
function mix(a: number, p: Vector, b: number, q: Vector): Vector {
  return vector(a * p.x + b * q.x, a * p.y + b * q.y, a * p.z + b * q.z);
}

/**
 * A frame for a body or an orbit: a pole, and two directions square to it, `zero` (where
 * longitude 0 lies at rest) and `quarter`. The point at longitude λ is
 * `cos λ · zero − sin λ · quarter`, and λ grows eastward, the way both bodies turn and
 * the Moon goes round: seen from above the north pole, anticlockwise.
 */
interface Frame {
  readonly pole: Vector;
  readonly zero: Vector;
  readonly quarter: Vector;
}

function frame(pole: Vector, zero: Vector): Frame {
  return { pole, zero, quarter: cross(pole, zero) };
}

/** The point on a frame's unit sphere at `latitude` and `longitude`. */
function pointAt(f: Frame, latitude: number, longitude: number): Vector {
  const round = mix(Math.cos(longitude), f.zero, -Math.sin(longitude), f.quarter);
  return mix(Math.cos(latitude), round, Math.sin(latitude), f.pole);
}

/** Latitude, in radians, of the unit vector `(x, y, z)` in a frame. */
function latitudeOf(f: Frame, x: number, y: number, z: number): number {
  const { pole } = f;
  return Math.asin(Math.max(-1, Math.min(1, x * pole.x + y * pole.y + z * pole.z)));
}

/** Longitude, in radians, of the vector `(x, y, z)` in a frame. */
function longitudeOf(f: Frame, x: number, y: number, z: number): number {
  const { zero, quarter } = f;
  return Math.atan2(
    -(x * quarter.x + y * quarter.y + z * quarter.z),
    x * zero.x + y * zero.y + z * zero.z,
  );
}

/** Latitude and longitude, in radians, of a unit vector in a frame. */
function coordinates(f: Frame, n: Vector): [number, number] {
  return [latitudeOf(f, n.x, n.y, n.z), longitudeOf(f, n.x, n.y, n.z)];
}

/** The ecliptic: its pole up and left, tipped toward the reader; longitude 0 to the right. */
const ECLIPTIC = frame(
  vector(
    -Math.cos(OPENING) * Math.sin(TILT),
    -Math.cos(OPENING) * Math.cos(TILT),
    Math.sin(OPENING),
  ),
  vector(Math.cos(TILT), -Math.sin(TILT), 0),
);
/**
 * The Earth at rest: its axis leaned toward the right, against the ecliptic's lean to
 * the left, so the globe stands nearly upright in the picture.
 */
const EARTH = frame(
  mix(Math.cos(OBLIQUITY), ECLIPTIC.pole, Math.sin(OBLIQUITY), ECLIPTIC.zero),
  ECLIPTIC.quarter,
);
/** The Moon's orbit, tilted about its line of nodes (ecliptic longitude 0). */
const ORBIT_FRAME = frame(
  mix(
    Math.cos(INCLINATION),
    ECLIPTIC.pole,
    Math.sin(INCLINATION),
    pointAt(ECLIPTIC, 0, -Math.PI / 2),
  ),
  ECLIPTIC.zero,
);
/** Toward the sun: in the ecliptic, from in front of the reader and to the left. */
export const SUN = pointAt(ECLIPTIC, 0, 232 * DEG);
/** The Moon's mean anomaly at time 0: on the near side, just right of the Earth. */
const START = 300 * DEG;

/** Where the Moon is at `time` seconds, and how far it has turned on its axis. */
export function moonAt(time: number): { center: Vector; turned: number } {
  // Kepler's equation, M = E − e sin E, by Newton's method; then the true anomaly ν.
  const mean = START + (2 * Math.PI * time) / MONTH;
  let eccentric = mean;
  for (let i = 0; i < 5; i++) {
    eccentric -=
      (eccentric - ECCENTRICITY * Math.sin(eccentric) - mean) /
      (1 - ECCENTRICITY * Math.cos(eccentric));
  }
  const e = ECCENTRICITY;
  const anomaly =
    2 *
    Math.atan2(
      Math.sqrt(1 + e) * Math.sin(eccentric / 2),
      Math.sqrt(1 - e) * Math.cos(eccentric / 2),
    );
  const distance = ORBIT * (1 - e * Math.cos(eccentric));
  const direction = pointAt(ORBIT_FRAME, 0, anomaly);
  // Locked: it turns once a month, evenly, so its longitude 0 faces the Earth on average.
  return { center: scaled(distance, direction), turned: mean + Math.PI };
}

/** Linear ramp between two edges, clamped to [0, 1]. */
function ramp(value: number, from: number, to: number): number {
  return Math.min(1, Math.max(0, (value - from) / (to - from)));
}

/** The land map, one byte per cell (0 or 1), row 0 at the north pole, column 0 at 180° W. */
const LAND = (() => {
  const bits = Uint8Array.from(atob(EARTH_MAP), (c) => c.charCodeAt(0));
  const land = new Uint8Array(EARTH_MAP_COLUMNS * EARTH_MAP_ROWS);
  for (let i = 0; i < land.length; i++) land[i] = (bits[i >> 3]! >> (7 - (i & 7))) & 1;
  return land;
})();

/** How much land is at a latitude and longitude, 0 to 1, blended between map cells. */
export function landAt(latitude: number, longitude: number): number {
  const u = ((((longitude / DEG + 180) % 360) + 360) % 360) / (360 / EARTH_MAP_COLUMNS) - 0.5;
  const v = (90 - latitude / DEG) / (180 / EARTH_MAP_ROWS) - 0.5;
  const row0 = Math.max(0, Math.min(EARTH_MAP_ROWS - 1, Math.floor(v)));
  const row1 = Math.min(EARTH_MAP_ROWS - 1, row0 + 1);
  const fv = Math.max(0, Math.min(1, v - row0));
  const column0 = (Math.floor(u) + EARTH_MAP_COLUMNS) % EARTH_MAP_COLUMNS;
  const column1 = (column0 + 1) % EARTH_MAP_COLUMNS;
  const fu = u - Math.floor(u);
  const cell = (row: number, column: number) => LAND[row * EARTH_MAP_COLUMNS + column]!;
  const top = cell(row0, column0) * (1 - fu) + cell(row0, column1) * fu;
  const bottom = cell(row1, column0) * (1 - fu) + cell(row1, column1) * fu;
  return top * (1 - fv) + bottom * fv;
}

/** A mare on the Moon: center (selenographic latitude, longitude east) and radius, in degrees. */
const MARIA: readonly (readonly [number, number, number])[] = [
  [18, -57, 24], // Oceanus Procellarum
  [33, -16, 17], // Imbrium
  [28, 17, 10], // Serenitatis
  [8, 31, 12], // Tranquillitatis
  [17, 59, 8], // Crisium
  [-8, 51, 11], // Fecunditatis
  [-15, 34, 6], // Nectaris
  [-21, -17, 11], // Nubium
  [-24, -39, 7], // Humorum
  [56, 0, 8], // Frigoris (a long band; a patch will do)
  [-3, -16, 9], // Insularum
];

/** The maria's centers as points on the unit sphere, with their radii in degrees. */
const MARE_CENTERS = MARIA.map(([latitude, longitude, radius]) => ({
  center: pointAt(ECLIPTIC, latitude * DEG, longitude * DEG),
  radius,
}));

/** Samples round a body in the tables of cloud and mare, and from pole to pole. */
const AROUND = 180;
const UP = 90;

/** A table of `UP × AROUND` values over a unit sphere, from a function of a point on it. */
function sphereTable(value: (latitude: number, longitude: number) => number): Float32Array {
  const table = new Float32Array(UP * AROUND);
  for (let row = 0; row < UP; row++) {
    const latitude = (90 - ((row + 0.5) * 180) / UP) * DEG;
    for (let column = 0; column < AROUND; column++) {
      table[row * AROUND + column] = value(latitude, (((column + 0.5) * 360) / AROUND - 180) * DEG);
    }
  }
  return table;
}

/** Look a latitude and longitude up in a sphere table. */
function lookup(table: Float32Array, latitude: number, longitude: number): number {
  const row = Math.max(0, Math.min(UP - 1, Math.floor(((90 - latitude / DEG) * UP) / 180)));
  const column = Math.floor(((((longitude / DEG + 180) % 360) + 360) % 360) * (AROUND / 360));
  return table[row * AROUND + Math.min(AROUND - 1, column)]!;
}

/** Noise on the unit sphere at a latitude and longitude, seamless. */
function sphereNoise(latitude: number, longitude: number, scale: number, seed: number): number {
  const c = Math.cos(latitude);
  return fractalNoise3(
    c * Math.cos(longitude) * scale + 7,
    c * Math.sin(longitude) * scale + 3,
    Math.sin(latitude) * scale + 5,
    seed,
  );
}

/** The two tables (cloud cover on the Earth; brightness of the Moon's face), built on first use. */
let tables: Tables | null = null;

/** Cloud cover on the Earth, and brightness of the Moon's face, as sphere tables. */
interface Tables {
  readonly clouds: Float32Array;
  readonly moon: Float32Array;
}

function surfaceTables(): Tables {
  tables ??= {
    clouds: sphereTable((latitude, longitude) =>
      ramp(sphereNoise(latitude, longitude, 3, 21), 0.6, 0.72),
    ),
    moon: sphereTable((latitude, longitude) => {
      // Any frame will do for angles on the sphere; the ecliptic's is at hand.
      const here = pointAt(ECLIPTIC, latitude, longitude);
      // Ragged edges: each mare's reach wavers with the noise.
      const waver = 1 + 0.5 * (sphereNoise(latitude, longitude, 4, 33) - 0.5);
      let mare = 0;
      for (const { center, radius } of MARE_CENTERS) {
        const angle = Math.acos(Math.min(1, dot(here, center))) / DEG;
        mare = Math.max(mare, 1 - ramp(angle, radius * waver * 0.8, radius * waver * 1.1));
      }
      const mottle = sphereNoise(latitude, longitude, 6, 41);
      return (0.8 + 0.25 * mottle) * (1 - 0.7 * mare);
    }),
  };
  return tables;
}

/** Brightness of sunlight on a surface whose normal is `(x, y, z)`, soft across the terminator. */
function daylight(x: number, y: number, z: number): number {
  return ramp(x * SUN.x + y * SUN.y + z * SUN.z, -0.06, 0.2);
}

/** How the scene stands at one moment: the Earth's spin and the Moon's place. */
interface Moment {
  readonly spin: number;
  readonly moon: Vector;
  readonly moonFrame: Frame;
}

function momentAt(time: number): Moment {
  const { center, turned } = moonAt(time);
  // The Moon's axis is near enough the orbit's pole; longitude 0 turns with it.
  const zero = pointAt(ORBIT_FRAME, 0, turned);
  return {
    spin: (2 * Math.PI * time) / DAY,
    moon: center,
    moonFrame: frame(ORBIT_FRAME.pole, zero),
  };
}

/**
 * Latitude and longitude east, in radians, of the point on the Earth whose outward normal
 * is `n` in the picture, when the Earth has turned `spin` radians from rest.
 */
export function earthCoordinates(n: Vector, spin: number): [number, number] {
  const [latitude, longitude] = coordinates(EARTH, n);
  return [latitude, longitude - spin];
}

/**
 * Selenographic latitude and longitude, in radians, of the point on the Moon facing the
 * Earth at `time` seconds: near (0, 0) always, rocking with libration.
 */
export function subEarthPoint(time: number): [number, number] {
  const now = momentAt(time);
  const length = Math.hypot(now.moon.x, now.moon.y, now.moon.z);
  return coordinates(now.moonFrame, scaled(-1 / length, now.moon));
}

/** The Earth's center. */
const ORIGIN = vector(0, 0, 0);

/** Where a ray straight into the picture at `(x, y)` meets a sphere, as the depth z, or −∞. */
function hit(x: number, y: number, center: Vector, radius: number): number {
  const d2 = (x - center.x) ** 2 + (y - center.y) ** 2;
  return d2 < radius * radius ? center.z + Math.sqrt(radius * radius - d2) : -Infinity;
}

/**
 * Ink at one point of the picture, in Earth radii from the Earth's center. Kept free of
 * allocation: it runs for every sample of every frame.
 */
function inkAt(x: number, y: number, now: Moment, { clouds, moon }: Tables): number {
  const earthZ = hit(x, y, ORIGIN, 1);
  const moonZ = hit(x, y, now.moon, MOON_RADIUS);
  if (earthZ === -Infinity && moonZ === -Infinity) return 0;

  if (moonZ > earthZ) {
    const nx = (x - now.moon.x) / MOON_RADIUS;
    const ny = (y - now.moon.y) / MOON_RADIUS;
    const nz = (moonZ - now.moon.z) / MOON_RADIUS;
    const face = lookup(
      moon,
      latitudeOf(now.moonFrame, nx, ny, nz),
      longitudeOf(now.moonFrame, nx, ny, nz),
    );
    const rim = 0.5 * ramp(1 - nz, 0.6, 0.92);
    return Math.max(rim, daylight(nx, ny, nz) * face);
  }

  const latitude = latitudeOf(EARTH, x, y, earthZ);
  const east = longitudeOf(EARTH, x, y, earthZ) - now.spin;
  const land = ramp(landAt(latitude, east), 0.35, 0.65);
  const ice = ramp(Math.abs(latitude), 72 * DEG, 78 * DEG);
  // Clouds drift slowly against the ground.
  const cloud = lookup(clouds, latitude, east + now.spin * 0.08) * 0.55;
  const ground = Math.max(0.16 + 0.72 * Math.max(land, ice), cloud);
  const rim = 0.5 * ramp(1 - earthZ, 0.6, 0.92);
  return Math.max(rim, daylight(x, y, earthZ) * ground);
}

/** The farthest the scene reaches from the Earth's center, across and down, in Earth radii. */
export const EXTENT = (() => {
  let [x, y] = [1, 1];
  for (let i = 0; i < 720; i++) {
    const { center } = moonAt((i / 720) * MONTH);
    x = Math.max(x, Math.abs(center.x) + MOON_RADIUS);
    y = Math.max(y, Math.abs(center.y) + MOON_RADIUS);
  }
  return { x, y } as const;
})();

/**
 * Ink below the first amount is dropped and above the second is solid, so the dither
 * keeps coastlines crisp and stipples only the half-tones.
 */
const CONTRAST = [0.1, 0.8] as const;
/** Samples per cell edge: each cell's ink is the mean of this many squared. */
const SUPERSAMPLE = 2;

/**
 * The scene as `columns × rows` ink amounts at `time` seconds, 0 (none) to 1 (solid),
 * row by row, scaled to fit with a cell to spare at the edges.
 */
export function skyInk(columns: number, rows: number, time = 0): Float32Array {
  const scale = Math.min((columns / 2 - 1) / EXTENT.x, (rows / 2 - 1) / EXTENT.y);
  const now = momentAt(time);
  const surfaces = surfaceTables();
  const ink = new Float32Array(columns * rows);
  const step = 1 / SUPERSAMPLE;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      let sum = 0;
      for (let v = 0; v < SUPERSAMPLE; v++) {
        for (let u = 0; u < SUPERSAMPLE; u++) {
          const x = (column + (u + 0.5) * step - columns / 2) / scale;
          const y = (row + (v + 0.5) * step - rows / 2) / scale;
          sum += inkAt(x, y, now, surfaces);
        }
      }
      ink[row * columns + column] = ramp(sum / SUPERSAMPLE ** 2, CONTRAST[0], CONTRAST[1]);
    }
  }
  return ink;
}

/** The scene as `columns × rows` cells at `time` seconds, 1 where the cell is inked. */
export function skyBits(columns: number, rows: number, time = 0): Uint8Array {
  return ditherBits(skyInk(columns, rows, time), columns, rows);
}
