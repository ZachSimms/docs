/** Unit tests for the home page's Earth and Moon (`lib/earth-moon.ts`, `lib/earth-map.ts`). */
import { describe, expect, it } from "bun:test";
import {
  DAY,
  ECCENTRICITY,
  MONTH,
  OBLIQUITY,
  ORBIT,
  POLES,
  earthCoordinates,
  landAt,
  moonAt,
  skyBits,
  skyInk,
  subEarthPoint,
} from "@/lib/earth-moon";
import { EARTH_MAP, EARTH_MAP_COLUMNS, EARTH_MAP_ROWS } from "@/lib/earth-map";

const DEG = Math.PI / 180;
const COLUMNS = 456;
const ROWS = 166;

describe("the land map", () => {
  it("holds one bit per 2° cell, about 29% of them land", () => {
    const bytes = Uint8Array.from(atob(EARTH_MAP), (c) => c.charCodeAt(0));
    expect(bytes.length * 8).toBe(EARTH_MAP_COLUMNS * EARTH_MAP_ROWS);
    let land = 0;
    for (const byte of bytes) for (let bit = 0; bit < 8; bit++) land += (byte >> bit) & 1;
    // By area the Earth is 29% land; counted by cell, the land-heavy high latitudes weigh more.
    expect(land / (EARTH_MAP_COLUMNS * EARTH_MAP_ROWS)).toBeGreaterThan(0.25);
    expect(land / (EARTH_MAP_COLUMNS * EARTH_MAP_ROWS)).toBeLessThan(0.33);
  });

  it("puts the land and sea where they are", () => {
    const at = (latitude: number, longitude: number) => landAt(latitude * DEG, longitude * DEG);
    // Land: the Congo, Kansas, central Australia, the Amazon, Siberia, Antarctica.
    for (const [lat, lon] of [
      [0, 22],
      [38, -98],
      [-25, 134],
      [-5, -60],
      [62, 100],
      [-85, 0],
    ]) {
      expect(at(lat!, lon!)).toBe(1);
    }
    // Sea: mid-Atlantic, mid-Pacific (either side of the date line), Indian Ocean.
    for (const [lat, lon] of [
      [30, -40],
      [0, -150],
      [10, 179],
      [-30, 80],
    ]) {
      expect(at(lat!, lon!)).toBe(0);
    }
  });
});

describe("the Earth", () => {
  it("is tilted 23.44° from the ecliptic's pole, leaning right in a level picture", () => {
    const { earth, ecliptic } = POLES;
    const angle = Math.acos(earth.x * ecliptic.x + earth.y * ecliptic.y + earth.z * ecliptic.z);
    expect(angle / DEG).toBeCloseTo(23.44, 2);
    expect(OBLIQUITY / DEG).toBeCloseTo(23.44, 2);
    // The ecliptic lies level: its pole has no sideways lean in the picture.
    expect(ecliptic.x).toBeCloseTo(0);
    // So the Earth's axis shows the whole tilt (a little more, tipped toward the reader).
    const lean = Math.atan2(earth.x, -earth.y) / DEG;
    expect(lean).toBeGreaterThan(23.4);
    expect(lean).toBeLessThan(25);
  });

  /** The point of the Earth's near side at `(x, y)` in the picture. */
  const facing = (x: number, y: number) => ({ x, y, z: Math.sqrt(1 - x * x - y * y) });

  it("is drawn with east to the right and north up, not mirrored", () => {
    const [, west] = earthCoordinates(facing(-0.2, 0), 0);
    const [, east] = earthCoordinates(facing(0.2, 0), 0);
    expect(east).toBeGreaterThan(west);
    const [north] = earthCoordinates(facing(0, -0.4), 0);
    const [south] = earthCoordinates(facing(0, 0.4), 0);
    expect(north).toBeGreaterThan(south);
  });

  it("turns west to east: a quarter turn brings the longitude 90° west round to face the reader", () => {
    const [, now] = earthCoordinates(facing(0, 0), 0);
    const [, later] = earthCoordinates(facing(0, 0), ((2 * Math.PI) / DAY) * (DAY / 4));
    expect(((((now - later) / DEG) % 360) + 360) % 360).toBeCloseTo(90);
  });
});

describe("the Moon's orbit", () => {
  it("comes back round every month", () => {
    const [a, b] = [moonAt(7).center, moonAt(7 + MONTH).center];
    expect(b.x).toBeCloseTo(a.x);
    expect(b.y).toBeCloseTo(a.y);
    expect(b.z).toBeCloseTo(a.z);
  });

  it("is an ellipse: from perigee a(1 − e) to apogee a(1 + e)", () => {
    const distances = Array.from({ length: 600 }, (_, i) => {
      const { x, y, z } = moonAt((i / 600) * MONTH).center;
      return Math.hypot(x, y, z);
    });
    expect(Math.min(...distances)).toBeCloseTo(ORBIT * (1 - ECCENTRICITY), 2);
    expect(Math.max(...distances)).toBeCloseTo(ORBIT * (1 + ECCENTRICITY), 2);
  });

  it("sweeps equal areas in equal times (Kepler's second law): fastest when nearest", () => {
    const sweep = (time: number) => {
      const [a, b] = [moonAt(time).center, moonAt(time + 0.01).center];
      const cross = [a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x];
      return { area: Math.hypot(...cross) / 2, distance: Math.hypot(a.x, a.y, a.z) };
    };
    const samples = Array.from({ length: 60 }, (_, i) => sweep((i / 60) * MONTH));
    const areas = samples.map((s) => s.area);
    for (const area of areas) expect(area / areas[0]!).toBeCloseTo(1, 3);
    // Equal areas, so the angle swept is largest at the smallest distance.
    const nearest = samples.reduce((a, b) => (b.distance < a.distance ? b : a));
    const farthest = samples.reduce((a, b) => (b.distance > a.distance ? b : a));
    expect(nearest.area / nearest.distance ** 2).toBeGreaterThan(
      farthest.area / farthest.distance ** 2,
    );
  });

  it("goes round the same way the Earth turns: left to right across the near side", () => {
    // Find when the Moon is nearest the reader, and see which way it is moving then.
    let front = 0;
    for (let i = 1; i < 600; i++) {
      if (moonAt((i / 600) * MONTH).center.z > moonAt(front).center.z) front = (i / 600) * MONTH;
    }
    expect(moonAt(front + 0.5).center.x).toBeGreaterThan(moonAt(front - 0.5).center.x);
  });

  it("keeps one face to the Earth, rocking by libration of about 2e (6.3°)", () => {
    let [lowest, highest] = [Infinity, -Infinity];
    for (let i = 0; i < 400; i++) {
      const [latitude, longitude] = subEarthPoint((i / 400) * MONTH);
      expect(Math.abs(latitude)).toBeLessThan(1e-9);
      lowest = Math.min(lowest, longitude);
      highest = Math.max(highest, longitude);
    }
    expect(highest / DEG).toBeCloseTo((2 * ECCENTRICITY) / DEG, 1);
    expect(lowest / DEG).toBeCloseTo((-2 * ECCENTRICITY) / DEG, 1);
  });
});

describe("skyBits", () => {
  it("fills the grid, leaves the corners empty, and inks the Earth's day side", () => {
    const bits = skyBits(COLUMNS, ROWS);
    expect(bits).toHaveLength(COLUMNS * ROWS);
    for (const corner of [0, COLUMNS - 1, (ROWS - 1) * COLUMNS, COLUMNS * ROWS - 1]) {
      expect(bits[corner]).toBe(0);
    }
    let inked = 0;
    for (let y = ROWS / 2 - 10; y < ROWS / 2 + 10; y++) {
      for (let x = COLUMNS / 2 - 20; x < COLUMNS / 2; x++) inked += bits[y * COLUMNS + x]!;
    }
    expect(inked).toBeGreaterThan(40);
  });

  it("keeps its ink between 0 and 1", () => {
    for (const amount of skyInk(80, 44, 3)) {
      expect(amount).toBeGreaterThanOrEqual(0);
      expect(amount).toBeLessThanOrEqual(1);
    }
  });

  it("is repeatable at a given moment and moves as time passes", () => {
    expect([...skyBits(COLUMNS, ROWS, 2)]).toEqual([...skyBits(COLUMNS, ROWS, 2)]);
    expect([...skyBits(COLUMNS, ROWS, 2)]).not.toEqual([...skyBits(COLUMNS, ROWS, 0)]);
  });
});
