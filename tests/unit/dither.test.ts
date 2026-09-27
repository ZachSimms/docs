/** Unit tests for the home page's dither pattern (`lib/dither.ts`). */
import { describe, expect, it } from "bun:test";
import {
  BAYER_8,
  bayerThreshold,
  ditherField,
  ditherMask,
  fractalNoise,
  valueNoise,
} from "@/lib/dither";

describe("Bayer matrix", () => {
  it("holds every threshold 0–63 exactly once", () => {
    expect([...BAYER_8].sort((a, b) => a - b)).toEqual(Array.from({ length: 64 }, (_, i) => i));
  });

  it("gives thresholds strictly between 0 and 1 that repeat every 8 cells", () => {
    expect(bayerThreshold(0, 0)).toBeCloseTo(0.5 / 64);
    expect(bayerThreshold(8, 16)).toBe(bayerThreshold(0, 0));
    for (let i = 0; i < 64; i++) {
      const t = bayerThreshold(i % 8, Math.floor(i / 8));
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(1);
    }
  });
});

describe("noise", () => {
  it("stays in [0, 1), is repeatable, and changes with the seed", () => {
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37;
      const y = i * 0.61;
      const v = fractalNoise(x, y, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(fractalNoise(x, y, 7)).toBe(v);
    }
    expect(valueNoise(1.5, 2.5, 7)).not.toBe(valueNoise(1.5, 2.5, 8));
  });

  it("is continuous: nearby points have nearby values", () => {
    expect(Math.abs(valueNoise(3.5, 4.5, 7) - valueNoise(3.501, 4.5, 7))).toBeLessThan(0.01);
  });
});

describe("ditherField and ditherMask", () => {
  it("keeps the field in [0, 1] and brighter toward the bottom on average", () => {
    let top = 0;
    let bottom = 0;
    for (let i = 0; i < 100; i++) {
      const u = i / 100;
      const a = ditherField(u, 0.05, 0, 7);
      const b = ditherField(u, 0.95, 0, 7);
      for (const v of [a, b]) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      top += a;
      bottom += b;
    }
    expect(bottom).toBeGreaterThan(top);
  });

  it("lights more cells in the bottom third than the top, and is deterministic", () => {
    const columns = 120;
    const rows = 60;
    const mask = ditherMask(columns, rows, 0, 7);
    expect(mask).toHaveLength(columns * rows);
    expect([...mask].every((bit) => bit === 0 || bit === 1)).toBe(true);
    const lit = (from: number, to: number) =>
      mask.slice(from * columns, to * columns).reduce((sum, bit) => sum + bit, 0);
    expect(lit(40, 60)).toBeGreaterThan(lit(0, 20) * 2);
    // The top rows fade in from nearly empty.
    expect(lit(0, 3)).toBeLessThan(columns * 3 * 0.1);
    expect(ditherMask(columns, rows, 0, 7)).toEqual(mask);
    expect(ditherMask(columns, rows, 0.5, 7)).not.toEqual(mask);
  });
});
