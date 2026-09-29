/** Unit tests for the home page's ringed planet (`lib/planet.ts`). */
import { describe, expect, it } from "bun:test";
import {
  EXTENT,
  OPENING,
  RING_INNER,
  RING_OUTER,
  TILT,
  planetBits,
  planetInk,
  ringletPeriod,
} from "@/lib/planet";

const COLUMNS = 252;
const ROWS = 136;

/** Share of inked cells in a box of the drawing, given by fractions of its width and height. */
function density(bits: Uint8Array, [x0, x1]: number[], [y0, y1]: number[]): number {
  let inked = 0;
  let cells = 0;
  for (let y = Math.floor(y0! * ROWS); y < Math.floor(y1! * ROWS); y++) {
    for (let x = Math.floor(x0! * COLUMNS); x < Math.floor(x1! * COLUMNS); x++) {
      inked += bits[y * COLUMNS + x]!;
      cells++;
    }
  }
  return inked / cells;
}

describe("planet geometry", () => {
  it("fits the rings' ends across and the globe down", () => {
    // The rings' outline is an ellipse RING_OUTER long and RING_OUTER·sin(OPENING) short.
    const [a, b] = [RING_OUTER, RING_OUTER * Math.sin(OPENING)];
    expect(EXTENT.x).toBeCloseTo(Math.hypot(a * Math.cos(TILT), b * Math.sin(TILT)));
    expect(EXTENT.x).toBeGreaterThan(1);
    expect(EXTENT.y).toBe(1);
  });
});

describe("planetBits", () => {
  const bits = planetBits(COLUMNS, ROWS);

  it("fills the grid and leaves the corners empty", () => {
    expect(bits).toHaveLength(COLUMNS * ROWS);
    for (const corner of [0, COLUMNS - 1, (ROWS - 1) * COLUMNS, COLUMNS * ROWS - 1]) {
      expect(bits[corner]).toBe(0);
    }
  });

  it("inks the rings' ends: low on the left and high on the right", () => {
    const leftLow = density(bits, [0, 0.12], [0.6, 0.9]);
    expect(leftLow).toBeGreaterThan(0.2);
    expect(density(bits, [0, 0.12], [0, 0.3])).toBe(0);
    expect(density(bits, [0.88, 1], [0.15, 0.4])).toBeGreaterThan(0.2);
    expect(density(bits, [0.88, 1], [0.7, 1])).toBe(0);
  });

  it("leaves the globe's face dark between its banded crescent and the rings in front", () => {
    const face = density(bits, [0.44, 0.56], [0.42, 0.52]);
    const crescent = density(bits, [0.3, 0.7], [0.12, 0.32]);
    expect(face).toBeLessThan(0.1);
    expect(crescent).toBeGreaterThan(face * 3);
  });

  it("keeps its ink between 0 and 1", () => {
    for (const amount of planetInk(60, 32, 3)) {
      expect(amount).toBeGreaterThanOrEqual(0);
      expect(amount).toBeLessThanOrEqual(1);
    }
  });
});

describe("planet turning", () => {
  it("is repeatable at a given moment and moves the streaks as time passes", () => {
    expect([...planetBits(COLUMNS, ROWS, 2)]).toEqual([...planetBits(COLUMNS, ROWS, 2)]);
    expect([...planetBits(COLUMNS, ROWS, 2)]).not.toEqual([...planetBits(COLUMNS, ROWS, 0)]);
  });

  it("turns the markings, not the outline: the empty corners stay empty", () => {
    for (const time of [0, 7, 31, 600]) {
      const later = planetBits(COLUMNS, ROWS, time);
      expect(density(later, [0, 0.12], [0, 0.3])).toBe(0);
      expect(density(later, [0.88, 1], [0.7, 1])).toBe(0);
      expect(density(later, [0, 0.12], [0.6, 0.9])).toBeGreaterThan(0.2);
    }
  });

  it("turns inner ringlets faster than outer ones, by Kepler's third law", () => {
    expect(ringletPeriod(RING_OUTER)).toBe(60);
    expect(ringletPeriod(RING_INNER)).toBeLessThan(ringletPeriod(RING_OUTER));
    expect(ringletPeriod(RING_INNER) / ringletPeriod(RING_OUTER)).toBeCloseTo(
      (RING_INNER / RING_OUTER) ** 1.5,
    );
  });
});
