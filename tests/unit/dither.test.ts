/** Unit tests for the home page's dither pattern (`lib/dither.ts`). */
import { describe, expect, it } from "bun:test";
import {
  BAYER_8,
  bayerThreshold,
  ditherBits,
  fractalNoise3,
  valueNoise,
  valueNoise3,
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
      const v = valueNoise(x, y, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(valueNoise(x, y, 7)).toBe(v);
    }
    expect(valueNoise(1.5, 2.5, 7)).not.toBe(valueNoise(1.5, 2.5, 8));
  });

  it("is continuous: nearby points have nearby values", () => {
    expect(Math.abs(valueNoise(3.5, 4.5, 7) - valueNoise(3.501, 4.5, 7))).toBeLessThan(0.01);
  });

  it("works in space too: in [0, 1), repeatable, continuous, and varying with depth", () => {
    for (let i = 0; i < 200; i++) {
      const [x, y, z] = [i * 0.37 - 30, i * 0.61 - 50, i * 0.23 - 20];
      const v = fractalNoise3(x, y, z, 7);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      expect(fractalNoise3(x, y, z, 7)).toBe(v);
    }
    expect(Math.abs(valueNoise3(3.5, 4.5, 1.5, 7) - valueNoise3(3.5, 4.5, 1.501, 7))).toBeLessThan(
      0.01,
    );
    expect(valueNoise3(1.5, 2.5, 0.5, 7)).not.toBe(valueNoise3(1.5, 2.5, 1.5, 7));
  });
});

describe("ditherBits", () => {
  it("inks nothing at 0, everything at 1, and about half the cells at 0.5", () => {
    const size = 16;
    const count = (bits: Uint8Array) => bits.reduce((sum, bit) => sum + bit, 0);
    expect(count(ditherBits(new Float32Array(size * size).fill(0), size, size))).toBe(0);
    expect(count(ditherBits(new Float32Array(size * size).fill(1), size, size))).toBe(size * size);
    expect(count(ditherBits(new Float32Array(size * size).fill(0.5), size, size))).toBe(
      (size * size) / 2,
    );
  });
});
