/**
 * @file Sizes of the playground's resizable parts, in CSS pixels.
 *
 * Every size has bounds; stored values are validated and clamped so a bad
 * value can never make a pane vanish. The CSS also caps each size against its
 * container (`min(var(--x), 100% - …)`) so a size saved on a wide screen still
 * fits a narrow one.
 */

import { z } from "zod";

/** The resizable parts. */
export type LayoutPart = "tree" | "refs" | "output" | "preview" | "godot" | "http";

/** Size of every resizable part. */
export type Layout = Readonly<Record<LayoutPart, number>>;

/** Smallest, largest and default size of each part, and what it measures. */
export const LAYOUT_BOUNDS: Readonly<
  Record<LayoutPart, { min: number; max: number; initial: number; axis: "x" | "y"; label: string }>
> = {
  tree: { min: 160, max: 560, initial: 272, axis: "x", label: "file tree width" },
  refs: { min: 260, max: 1200, initial: 420, axis: "x", label: "reference panel width" },
  output: { min: 96, max: 1400, initial: 280, axis: "y", label: "output height" },
  preview: { min: 160, max: 1600, initial: 560, axis: "x", label: "preview width" },
  godot: { min: 160, max: 900, initial: 320, axis: "x", label: "Godot view width" },
  http: { min: 120, max: 1000, initial: 240, axis: "y", label: "HTTP request height" },
};

/** Sizes on a first visit. */
export const DEFAULT_LAYOUT: Layout = Object.fromEntries(
  Object.entries(LAYOUT_BOUNDS).map(([part, b]) => [part, b.initial]),
) as Record<LayoutPart, number>;

/** Keep a size inside its part's bounds (whole pixels). */
export function clampSize(part: LayoutPart, size: number): number {
  const { min, max } = LAYOUT_BOUNDS[part];
  return Math.round(
    Math.min(max, Math.max(min, Number.isFinite(size) ? size : LAYOUT_BOUNDS[part].initial)),
  );
}

/** A new layout with one part resized (clamped). */
export function resize(layout: Layout, part: LayoutPart, size: number): Layout {
  return { ...layout, [part]: clampSize(part, size) };
}

/** One stored size: clamped into bounds, or the default when it isn't a number. */
const size = (part: LayoutPart) =>
  z
    .number()
    .transform((n) => clampSize(part, n))
    .catch(LAYOUT_BOUNDS[part].initial);

/** Zod schema for a stored layout: each size clamped, anything missing or invalid replaced by the default. */
export const layoutSchema = z
  .object({
    tree: size("tree"),
    refs: size("refs"),
    output: size("output"),
    preview: size("preview"),
    godot: size("godot"),
    http: size("http"),
  })
  .partial()
  .transform((stored): Layout => ({ ...DEFAULT_LAYOUT, ...stored }))
  .catch(DEFAULT_LAYOUT);

/** The layout as CSS custom properties for `.playground`. */
export function layoutStyle(layout: Layout): Record<`--pg-${LayoutPart}`, string> {
  return Object.fromEntries(
    (Object.keys(layout) as LayoutPart[]).map((part) => [`--pg-${part}`, `${layout[part]}px`]),
  ) as Record<`--pg-${LayoutPart}`, string>;
}
