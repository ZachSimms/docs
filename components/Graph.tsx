/**
 * @file `<Graph>`: a small monochrome function plot rendered as inline SVG.
 *
 * Server component (`<Graphs>` is a two-column wrapper for small plots).
 * Everything is computed at build time from `lib/graph.ts`;
 * axes and labels use `currentColor`, so they follow the theme like the rest of
 * the text. Curves are told apart by colour: `--graph-0` … `--graph-3` from the
 * stylesheet, with light and dark values, and a legend under the plot shows a
 * swatch of each. A plot with a single curve has nothing to tell apart, so its
 * legend is just the label with no swatch.
 */

import { Fragment, type ReactNode } from "react";
import {
  FUNCTIONS,
  curveLabel,
  project,
  sampleCurve,
  ticks as makeTicks,
  toPath,
  type Curve,
  type Frame,
  type FunctionName,
} from "@/lib/graph";

/** Props for {@link Graph}. */
interface GraphProps {
  /** Shorthand for a single untransformed catalogue function. */
  fn?: FunctionName;
  /** Curves to draw, in legend order; at most four stroke patterns are distinct. */
  curves?: readonly Curve[];
  /** `[xmin, xmax]`; defaults to the first curve's catalogue domain. */
  domain?: readonly [number, number];
  /** `[ymin, ymax]`; defaults to the first curve's catalogue range. */
  range?: readonly [number, number];
  /** Tick style: integers or multiples of π on the x-axis. */
  ticks?: "int" | "pi";
  /** Caption printed above the legend. */
  title?: string;
  /** Half-width plot so two sit side by side in the column. */
  small?: boolean;
}

/** Drawing frame in SVG units; scaled to the column by CSS. */
const FRAME: Frame = { width: 300, height: 190, pad: 18 };

/** Number of distinct curve colours defined in CSS (`--graph-0` … `--graph-3`). */
const COLOURS = 4;

/** Clamp an axis position into the window so an axis is always drawn. */
function axisAt(window: readonly [number, number]): number {
  const [lo, hi] = window;
  return Math.min(Math.max(0, lo), hi);
}

/**
 * Render the plot: axes through the origin (or the nearest edge), tick marks
 * with labels, one coloured `<path>` per curve, and a legend with matching swatches.
 */
export function Graph({ fn, curves, domain, range, ticks = "int", title, small }: GraphProps) {
  const list: readonly Curve[] = curves ?? (fn ? [{ fn }] : []);
  const first = list[0];
  if (!first) return null;
  const entry = FUNCTIONS[first.fn];
  const win = { domain: domain ?? entry.domain, range: range ?? entry.range };
  const px = project(FRAME, win.domain, win.range);

  const x0 = axisAt(win.domain);
  const y0 = axisAt(win.range);
  const [axisX, axisY] = px([x0, y0]);
  const [left] = px([win.domain[0], 0]);
  const [right] = px([win.domain[1], 0]);
  const [, top] = px([0, win.range[1]]);
  const [, bottom] = px([0, win.range[0]]);
  const xTicks = makeTicks(win.domain, ticks);
  const yTicks = makeTicks(win.range, "int");

  const label = title ?? list.map(curveLabel).join(", ");
  const showSwatches = list.length > 1;

  return (
    <figure className={small ? "graph graph-small" : "graph"}>
      <svg
        viewBox={`0 0 ${FRAME.width} ${FRAME.height}`}
        role="img"
        aria-label={`Graph of ${label}`}
        fill="none"
        stroke="currentColor"
      >
        <g className="graph-axes" strokeWidth="1" opacity="0.45">
          <line x1={left} y1={axisY} x2={right} y2={axisY} />
          <line x1={axisX} y1={top} x2={axisX} y2={bottom} />
          {xTicks.map((t) => {
            const [tx] = px([t.at, 0]);
            return (
              <Fragment key={`x${t.at}`}>
                <line x1={tx} y1={axisY - 3} x2={tx} y2={axisY + 3} />
                <text x={tx} y={axisY + 12} textAnchor="middle" stroke="none" fill="currentColor">
                  {t.label}
                </text>
              </Fragment>
            );
          })}
          {yTicks.map((t) => {
            const [, ty] = px([0, t.at]);
            return (
              <Fragment key={`y${t.at}`}>
                <line x1={axisX - 3} y1={ty} x2={axisX + 3} y2={ty} />
                <text x={axisX - 6} y={ty + 3} textAnchor="end" stroke="none" fill="currentColor">
                  {t.label}
                </text>
              </Fragment>
            );
          })}
        </g>
        {list.map((curve, i) => {
          const segments = sampleCurve(curve, win.domain, win.range).map((seg) => seg.map(px));
          return (
            <path
              key={`${curve.fn}-${i}`}
              className={`graph-curve graph-curve-${i % COLOURS}`}
              d={toPath(segments)}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
      <figcaption>
        {title && <b>{title}</b>}
        {list.map((curve, i) => (
          <span key={`${curve.fn}-${i}`} className="graph-legend">
            {showSwatches && (
              <>
                <span aria-hidden="true" className={`graph-swatch graph-curve-${i % COLOURS}`}>
                  ──
                </span>{" "}
              </>
            )}
            {curveLabel(curve)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

/** Two-column grid for `<Graph small>` plots, so pairs sit side by side regardless of whitespace. */
export function Graphs({ children }: { children: ReactNode }) {
  return <div className="graphs">{children}</div>;
}
