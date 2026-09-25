/**
 * @file Pure geometry for the `<Graph>` component: the function catalogue,
 * the transform model `y = a·f(b·(x − h)) + k`, sampling with breaks at
 * asymptotes, and conversion to SVG path data. No DOM, no React; fully tested.
 */

/** Names of the functions a graph can draw: section 1.12 of the maths sheet plus a few for the graph-reading sheet. */
export type FunctionName =
  | "line"
  | "identity"
  | "square"
  | "cube"
  | "recip"
  | "recip2"
  | "sqrt"
  | "abs"
  | "poly"
  | "sin"
  | "cos"
  | "tan"
  | "exp"
  | "ln";

/** A catalogue entry: the function plus a domain and range that show it well. */
export interface CatalogueEntry {
  readonly f: (x: number) => number;
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
  /** Plain-text formula for legends. */
  readonly formula: string;
}

/** The functions the maths sheets reference, with sensible default windows. */
export const FUNCTIONS: Record<FunctionName, CatalogueEntry> = {
  line: { f: (x) => x / 2 + 1, domain: [-3, 3], range: [-2, 3], formula: "x/2 + 1" },
  identity: { f: (x) => x, domain: [-3, 3], range: [-3, 3], formula: "x" },
  square: { f: (x) => x * x, domain: [-3, 3], range: [-1, 9], formula: "x²" },
  cube: { f: (x) => x ** 3, domain: [-2, 2], range: [-8, 8], formula: "x³" },
  recip: { f: (x) => 1 / x, domain: [-4, 4], range: [-4, 4], formula: "1/x" },
  recip2: { f: (x) => 1 / (x * x), domain: [-4, 4], range: [0, 4], formula: "1/x²" },
  sqrt: { f: (x) => Math.sqrt(x), domain: [0, 9], range: [-1, 3], formula: "√x" },
  abs: { f: (x) => Math.abs(x), domain: [-3, 3], range: [-1, 3], formula: "|x|" },
  poly: { f: (x) => x ** 3 - 3 * x, domain: [-2.5, 2.5], range: [-4, 4], formula: "x³ − 3x" },
  sin: { f: Math.sin, domain: [-2 * Math.PI, 2 * Math.PI], range: [-1.5, 1.5], formula: "sin x" },
  cos: { f: Math.cos, domain: [-2 * Math.PI, 2 * Math.PI], range: [-1.5, 1.5], formula: "cos x" },
  tan: { f: Math.tan, domain: [-Math.PI, Math.PI], range: [-4, 4], formula: "tan x" },
  exp: { f: Math.exp, domain: [-3, 2.2], range: [-1, 8], formula: "eˣ" },
  ln: { f: Math.log, domain: [0, 8], range: [-3, 3], formula: "ln x" },
};

/** One curve: a catalogue function with an optional transform and legend label. */
export interface Curve {
  readonly fn: FunctionName;
  /** Vertical scale; negative reflects in the x-axis. Default 1. */
  readonly a?: number;
  /** Horizontal scale applied inside; negative reflects in the y-axis. Default 1. */
  readonly b?: number;
  /** Horizontal shift (right is positive). Default 0. */
  readonly h?: number;
  /** Vertical shift (up is positive). Default 0. */
  readonly k?: number;
  /** Legend text; defaults to the catalogue formula. */
  readonly label?: string;
}

/** Evaluate `a·f(b·(x − h)) + k` for a curve. */
export function evaluate(curve: Curve, x: number): number {
  const { a = 1, b = 1, h = 0, k = 0 } = curve;
  return a * FUNCTIONS[curve.fn].f(b * (x - h)) + k;
}

/** Legend text for a curve. */
export function curveLabel(curve: Curve): string {
  return curve.label ?? FUNCTIONS[curve.fn].formula;
}

/** A point in data coordinates. */
export type Point = readonly [number, number];

/**
 * Sample a curve over `domain` into polyline segments.
 *
 * A new segment starts wherever the function is undefined, leaves the
 * padded range, or jumps by more than the range height between neighbouring
 * samples (an asymptote), so `tan x` draws as separate branches rather than
 * vertical lines.
 *
 * @param curve - The curve to sample.
 * @param domain - `[xmin, xmax]`.
 * @param range - `[ymin, ymax]`; points slightly outside are kept so lines exit the frame cleanly.
 * @param samples - Number of x positions; default 240.
 * @returns Segments, each a list of at least two points.
 */
export function sampleCurve(
  curve: Curve,
  domain: readonly [number, number],
  range: readonly [number, number],
  samples = 240,
): Point[][] {
  const [xmin, xmax] = domain;
  const [ymin, ymax] = range;
  const height = ymax - ymin;
  const lo = ymin - height * 0.25;
  const hi = ymax + height * 0.25;
  const segments: Point[][] = [];
  let current: Point[] = [];
  let previous: number | undefined;

  for (let i = 0; i <= samples; i += 1) {
    const x = xmin + ((xmax - xmin) * i) / samples;
    const y = evaluate(curve, x);
    const visible = Number.isFinite(y) && y >= lo && y <= hi;
    const jump = previous !== undefined && Number.isFinite(y) && Math.abs(y - previous) > height;
    if (!visible || jump) {
      if (current.length > 1) segments.push(current);
      current = visible ? [[x, y]] : [];
    } else {
      current = [...current, [x, y]];
    }
    previous = Number.isFinite(y) ? y : undefined;
  }
  if (current.length > 1) segments.push(current);
  return segments;
}

/** Pixel frame of the drawing: SVG size and the inset that leaves room for labels. */
export interface Frame {
  readonly width: number;
  readonly height: number;
  readonly pad: number;
}

/** Map data coordinates to SVG pixels for a frame and window. */
export function project(
  frame: Frame,
  domain: readonly [number, number],
  range: readonly [number, number],
): (p: Point) => Point {
  const [xmin, xmax] = domain;
  const [ymin, ymax] = range;
  const innerW = frame.width - 2 * frame.pad;
  const innerH = frame.height - 2 * frame.pad;
  return ([x, y]) => [
    frame.pad + ((x - xmin) / (xmax - xmin)) * innerW,
    frame.height - frame.pad - ((y - ymin) / (ymax - ymin)) * innerH,
  ];
}

/** Round for compact path data. */
function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/**
 * SVG path data for a list of projected segments: `M x y L x y …` per segment.
 *
 * @param segments - Segments already in pixel coordinates.
 */
export function toPath(segments: readonly (readonly Point[])[]): string {
  return segments
    .map((seg) => seg.map(([x, y], i) => `${i === 0 ? "M" : "L"}${fmt(x)} ${fmt(y)}`).join(" "))
    .join(" ");
}

/** An axis tick: position and label. */
export interface Tick {
  readonly at: number;
  readonly label: string;
}

/**
 * Ticks for an axis window.
 *
 * `"int"` gives every integer in the window (thinned to every 2 when there are
 * more than 9); `"pi"` gives multiples of π labelled `-2π … 2π`. Zero is never
 * labelled, since the axes cross there.
 */
export function ticks(window: readonly [number, number], kind: "int" | "pi" = "int"): Tick[] {
  const [lo, hi] = window;
  const unit = kind === "pi" ? Math.PI : 1;
  const first = Math.ceil(lo / unit);
  const last = Math.floor(hi / unit);
  const count = last - first + 1;
  const step = kind === "int" && count > 9 ? 2 : 1;
  const out: Tick[] = [];
  for (let n = first; n <= last; n += step) {
    if (n === 0) continue;
    const label = kind === "pi" ? (n === 1 ? "π" : n === -1 ? "-π" : `${n}π`) : String(n);
    out.push({ at: n * unit, label });
  }
  return out;
}
