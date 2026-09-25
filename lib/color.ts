/**
 * @file Colour maths for the swatch components, run at build time.
 *
 * Parses the CSS colour syntaxes the sheets use (hex, `rgb()`, `hsl()`,
 * `oklch()`), converts OKLCH to sRGB with Björn Ottosson's OKLab matrices,
 * computes WCAG 2 relative luminance and contrast, and builds gamut-safe
 * tonal scales. Anything it can't read throws, so a typo in a sheet fails the
 * build instead of rendering an empty chip.
 */

/** A gamma-encoded sRGB colour; channels are 0–1 (may fall outside when out of gamut). */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** An OKLCH colour: lightness 0–1, chroma ≥ 0, hue in degrees. */
export interface Oklch {
  readonly l: number;
  readonly c: number;
  readonly h: number;
}

/** WCAG 2 grade for a contrast ratio. "AA large" passes only for large text. */
export type WcagLevel = "AAA" | "AA" | "AA large" | "fail";

/** One step of a {@link tonalScale}. */
export interface ScaleStep {
  /** Tailwind-style step name, 50 (lightest) to 950 (darkest). */
  readonly step: number;
  /** Chroma actually used, after reducing it to stay in sRGB. */
  readonly chroma: number;
  /** The colour as CSS `oklch()`. */
  readonly css: string;
  /** The same colour as `#rrggbb`. */
  readonly hex: string;
}

/** Step names of a tonal scale, lightest first. */
export const SCALE_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/** OKLCH lightness for each of {@link SCALE_STEPS}. */
const SCALE_LIGHTNESS = [0.97, 0.93, 0.87, 0.79, 0.7, 0.61, 0.52, 0.44, 0.36, 0.28, 0.21] as const;

/** Rounding slack when testing gamut membership. */
const GAMUT_EPSILON = 1e-4;

const NUMBER = String.raw`[-+]?(?:\d+(?:\.\d+)?|\.\d+)`;
const ARG = String.raw`(${NUMBER})(%?)`;
const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
/** Modern space syntax, `fn(a b c)`, for every supported function. No alpha. */
const SPACED = new RegExp(String.raw`^(rgb|hsl|oklch)\(\s*${ARG}\s+${ARG}\s+${ARG}\s*\)$`, "i");
/** Legacy comma syntax, `fn(a, b, c)`: only `rgb()` and `hsl()` have it. No alpha. */
const COMMAS = new RegExp(String.raw`^(rgb|hsl)\(\s*${ARG}\s*,\s*${ARG}\s*,\s*${ARG}\s*\)$`, "i");

/** Clamp to the 0–1 range. */
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** sRGB transfer function: linear → gamma-encoded. */
const encode = (x: number) =>
  Math.abs(x) <= 0.0031308 ? 12.92 * x : Math.sign(x) * (1.055 * Math.abs(x) ** (1 / 2.4) - 0.055);

/** sRGB transfer function: gamma-encoded → linear. */
const decode = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

/**
 * Convert OKLCH to gamma-encoded sRGB (no clamping).
 *
 * @param color - The OKLCH colour.
 * @returns sRGB channels; values outside 0–1 mean the colour is out of gamut.
 */
export function oklchToSrgb({ l, c, h }: Oklch): Rgb {
  const rad = (h * Math.PI) / 180;
  const a = c * Math.cos(rad);
  const b = c * Math.sin(rad);
  const l1 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m1 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s1 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: encode(4.0767416621 * l1 - 3.3077115913 * m1 + 0.2309699292 * s1),
    g: encode(-1.2684380046 * l1 + 2.6097574011 * m1 - 0.3413193965 * s1),
    b: encode(-0.0041960863 * l1 - 0.7034186147 * m1 + 1.707614701 * s1),
  };
}

/** Convert HSL (degrees, 0–1, 0–1) to sRGB. */
function hslToSrgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: f(0), g: f(8), b: f(4) };
}

/**
 * Whether an sRGB colour is displayable (every channel within 0–1).
 *
 * @param rgb - Unclamped sRGB, e.g. from {@link oklchToSrgb}.
 */
export function inGamut({ r, g, b }: Rgb): boolean {
  return [r, g, b].every((x) => x >= -GAMUT_EPSILON && x <= 1 + GAMUT_EPSILON);
}

/** Clamp to a range, as CSS does for out-of-range colour arguments. */
const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** A hue in degrees, normalised into 0–360 (JS `%` keeps the sign). */
const normalizeHue = (h: number) => ((h % 360) + 360) % 360;

/** The error for a colour the parser (or a browser) wouldn't accept. */
const unsupported = (input: string) =>
  new Error(
    `Unsupported colour "${input}" (use hex, rgb(), hsl() or oklch() without alpha; ` +
      "commas only in rgb()/hsl(); hue without %; hsl saturation and lightness in %)",
  );

/**
 * Parse a CSS colour: `#rgb`, `#rrggbb`, `rgb()`, `hsl()` or `oklch()`.
 *
 * Only syntax that browsers also accept is allowed, so a chip can never render
 * empty while the build reports a colour: space syntax for all three
 * functions, comma syntax for `rgb()`/`hsl()` only, a unitless hue, and `%` on
 * `hsl()` saturation and lightness. Alpha is rejected, because contrast
 * figures for a translucent colour would depend on what's behind it.
 * Out-of-range arguments are clamped as CSS does.
 *
 * @param input - The CSS colour text.
 * @returns The colour as sRGB (unclamped for out-of-gamut OKLCH).
 * @throws {Error} For any other syntax, e.g. named colours or alpha.
 */
export function parseColor(input: string): Rgb {
  const text = input.trim();
  const hex = HEX.exec(text)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((ch) => ch + ch).join("") : hex;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
    return { r: r!, g: g!, b: b! };
  }
  const m = SPACED.exec(text) ?? COMMAS.exec(text);
  if (!m) throw unsupported(input);
  const [, fn, x, xPct, y, yPct, z, zPct] = m;
  const [n1, n2, n3] = [Number(x), Number(y), Number(z)];
  switch (fn!.toLowerCase()) {
    case "rgb": {
      const ch = (n: number, pct: string | undefined) => clamp(pct ? n / 100 : n / 255, 0, 1);
      return { r: ch(n1, xPct), g: ch(n2, yPct), b: ch(n3, zPct) };
    }
    case "hsl":
      if (xPct || !yPct || !zPct) throw unsupported(input);
      return hslToSrgb(normalizeHue(n1), clamp(n2 / 100, 0, 1), clamp(n3 / 100, 0, 1));
    default: {
      if (zPct) throw unsupported(input);
      const l = clamp(xPct ? n1 / 100 : n1, 0, 1);
      const c = Math.max(0, yPct ? (n2 / 100) * 0.4 : n2);
      return oklchToSrgb({ l, c, h: normalizeHue(n3) });
    }
  }
}

/**
 * Format as `#rrggbb`, clamping out-of-gamut channels.
 *
 * @param rgb - The sRGB colour.
 */
export function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b]
    .map((x) => Math.round(clamp01(x) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * WCAG 2 relative luminance (0 for black, 1 for white).
 *
 * @param rgb - The sRGB colour; clamped first.
 */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const [lr, lg, lb] = [r, g, b].map((x) => decode(clamp01(x)));
  return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

/**
 * WCAG 2 contrast ratio between two colours, 1 to 21 (order doesn't matter).
 *
 * @param a - One colour.
 * @param b - The other colour.
 */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/**
 * Grade a contrast ratio against WCAG 2 (1.4.3 AA and 1.4.6 AAA).
 *
 * @param ratio - From {@link contrastRatio}.
 * @param large - True for large text (≥ 24px, or ≥ 18.66px bold).
 * @returns `"AA large"` means the ratio passes for large text only.
 */
export function wcagLevel(ratio: number, large = false): WcagLevel {
  if (large) return ratio >= 4.5 ? "AAA" : ratio >= 3 ? "AA" : "fail";
  return ratio >= 7 ? "AAA" : ratio >= 4.5 ? "AA" : ratio >= 3 ? "AA large" : "fail";
}

/** The largest chroma ≤ `max` that keeps `(l, h)` inside sRGB (binary search). */
function maxInGamutChroma(l: number, h: number, max: number): number {
  if (inGamut(oklchToSrgb({ l, c: max, h }))) return max;
  let lo = 0;
  let hi = max;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToSrgb({ l, c: mid, h }))) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Round down to 3 decimals for CSS output, so rounding never leaves the gamut. */
const floor3 = (x: number) => Math.floor(x * 1000) / 1000;

/**
 * An 11-step tonal scale (50–950) for one hue, like Tailwind's palettes.
 *
 * Lightness is fixed per step; chroma is the requested value, reduced where
 * that step would leave the sRGB gamut, so every chip is displayable.
 *
 * @param hue - OKLCH hue in degrees.
 * @param chroma - Target OKLCH chroma (0.1–0.2 is typical for UI colours).
 */
export function tonalScale(hue: number, chroma: number): ScaleStep[] {
  return SCALE_STEPS.map((step, i) => {
    const l = SCALE_LIGHTNESS[i]!;
    const c = floor3(maxInGamutChroma(l, hue, chroma));
    return {
      step,
      chroma: c,
      css: `oklch(${l} ${c} ${hue})`,
      hex: toHex(oklchToSrgb({ l, c, h: hue })),
    };
  });
}
