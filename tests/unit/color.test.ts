/** Unit tests for `lib/color.ts`: parsing, OKLCH → sRGB, WCAG contrast and tonal scales. */
import { describe, expect, it } from "bun:test";
import {
  contrastRatio,
  inGamut,
  oklchToSrgb,
  parseColor,
  relativeLuminance,
  toHex,
  tonalScale,
  wcagLevel,
  SCALE_STEPS,
} from "@/lib/color";

describe("parseColor", () => {
  it("reads 3- and 6-digit hex", () => {
    expect(toHex(parseColor("#f00"))).toBe("#ff0000");
    expect(toHex(parseColor("#1F6FEB"))).toBe("#1f6feb");
  });

  it("reads rgb() and hsl() in space-separated and comma syntax", () => {
    expect(toHex(parseColor("rgb(255 128 0)"))).toBe("#ff8000");
    expect(toHex(parseColor("rgb(255, 128, 0)"))).toBe("#ff8000");
    expect(toHex(parseColor("hsl(120 100% 25%)"))).toBe("#008000");
    expect(toHex(parseColor("hsl(0, 0%, 100%)"))).toBe("#ffffff");
  });

  it("reads oklch() with lightness as a fraction or a percentage", () => {
    expect(toHex(parseColor("oklch(0.628 0.2577 29.23)"))).toBe("#ff0000");
    expect(toHex(parseColor("oklch(62.8% 0.2577 29.23)"))).toBe("#ff0000");
    expect(toHex(parseColor("oklch(1 0 0)"))).toBe("#ffffff");
    expect(toHex(parseColor("oklch(0 0 0)"))).toBe("#000000");
  });

  it("throws on anything it cannot read, so a typo fails the build", () => {
    expect(() => parseColor("red")).toThrow(/Unsupported color/);
    expect(() => parseColor("#12")).toThrow(/Unsupported color/);
    expect(() => parseColor("oklch(0.5 0.1)")).toThrow(/Unsupported color/);
  });

  it("rejects syntax browsers reject too, and any alpha", () => {
    for (const bad of [
      "oklch(0.5, 0.1, 30)",
      "rgb(255, 128 0)",
      "oklcha(0.5 0.1 30)",
      "hsl(50% 100% 50%)",
      "hsl(120 100 50)",
      "rgb(5. 0 0)",
      "rgb(0 0 0 / 0.2)",
      "rgba(0, 0, 0, 0.5)",
      "oklch(0.5 0.1 30%)",
    ]) {
      expect(() => parseColor(bad), bad).toThrow(/Unsupported color/);
    }
  });

  it("normalizes negative hues and clamps out-of-range arguments like CSS", () => {
    expect(toHex(parseColor("hsl(-120 100% 50%)"))).toBe("#0000ff");
    expect(toHex(parseColor("hsl(-360 100% 50%)"))).toBe("#ff0000");
    expect(toHex(parseColor("oklch(0.7 -0.1 30)"))).toBe(toHex(parseColor("oklch(0.7 0 30)")));
    expect(toHex(parseColor("oklch(1.4 0 0)"))).toBe("#ffffff");
    expect(toHex(parseColor("rgb(300 -5 0)"))).toBe("#ff0000");
  });
});

describe("oklchToSrgb / inGamut", () => {
  it("maps OKLCH to gamma-encoded sRGB", () => {
    const { r, g, b } = oklchToSrgb({ l: 0.628, c: 0.2577, h: 29.23 });
    expect(r).toBeCloseTo(1, 2);
    expect(g).toBeCloseTo(0, 2);
    expect(b).toBeCloseTo(0, 2);
  });

  it("flags colors outside sRGB", () => {
    expect(inGamut(oklchToSrgb({ l: 0.7, c: 0.1, h: 250 }))).toBe(true);
    expect(inGamut(oklchToSrgb({ l: 0.7, c: 0.4, h: 150 }))).toBe(false);
  });
});

describe("contrast", () => {
  it("gives black and white luminance 0 and 1, and a ratio of 21", () => {
    expect(relativeLuminance(parseColor("#000"))).toBe(0);
    expect(relativeLuminance(parseColor("#fff"))).toBeCloseTo(1, 10);
    expect(contrastRatio(parseColor("#000"), parseColor("#fff"))).toBeCloseTo(21, 5);
  });

  it("is symmetric and matches a known pair", () => {
    const gray = parseColor("#767676");
    const white = parseColor("#fff");
    expect(contrastRatio(gray, white)).toBeCloseTo(4.54, 2);
    expect(contrastRatio(white, gray)).toBeCloseTo(4.54, 2);
  });

  it("grades ratios for normal and large text", () => {
    expect(wcagLevel(7)).toBe("AAA");
    expect(wcagLevel(4.5)).toBe("AA");
    expect(wcagLevel(4.49)).toBe("AA large");
    expect(wcagLevel(3)).toBe("AA large");
    expect(wcagLevel(2.99)).toBe("fail");
    expect(wcagLevel(4.5, true)).toBe("AAA");
    expect(wcagLevel(3, true)).toBe("AA");
    expect(wcagLevel(2.9, true)).toBe("fail");
  });
});

describe("tonalScale", () => {
  const scale = tonalScale(250, 0.15);

  it("has one in-gamut entry per step, from light to dark", () => {
    expect(scale.map((s) => s.step)).toEqual([...SCALE_STEPS]);
    for (const s of scale) expect(inGamut(parseColor(s.css))).toBe(true);
    const lum = scale.map((s) => relativeLuminance(parseColor(s.hex)));
    for (let i = 1; i < lum.length; i++) expect(lum[i]!).toBeLessThan(lum[i - 1]!);
  });

  it("reduces chroma only where the requested one is out of gamut", () => {
    const vivid = tonalScale(150, 0.3);
    expect(vivid.every((s) => s.chroma <= 0.3)).toBe(true);
    expect(vivid.some((s) => s.chroma < 0.3)).toBe(true);
    expect(tonalScale(0, 0).every((s) => s.chroma === 0)).toBe(true);
  });
});
