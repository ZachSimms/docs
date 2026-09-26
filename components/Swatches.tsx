/**
 * @file Color chips for the design sheets: `<Swatches>`, `<Scale>` and `<Contrast>`.
 *
 * Server components with no client JS. Colors are the author's fixed values
 * and look the same in both site themes, as real swatches should; every value
 * goes through `lib/color.ts` at build time, so an unreadable color fails the
 * build instead of rendering an empty chip.
 *
 * @example
 * <Swatches title="60-30-10" colors={["#f4f1ea", "#23395b", "#e4572e"]} weights={[60, 30, 10]} />
 * <Scale title="Blue" hue={250} chroma={0.14} />
 * <Contrast fg="#767676" bg="#ffffff" />
 */

import type { ReactNode } from "react";
import { contrastRatio, parseColor, tonalScale, wcagLevel, type WcagLevel } from "@/lib/color";

/** A color given as a bare CSS value or with a display name. */
export type SwatchColor = string | { readonly name: string; readonly value: string };

/** A chip ready to draw: its CSS background and the lines printed under it. */
interface Chip {
  readonly css: string;
  readonly name?: string;
  readonly label: string;
}

/** Props for {@link Swatches}. */
interface SwatchesProps {
  /** The colors, in order: hex, `rgb()`, `hsl()` or `oklch()`. */
  colors: readonly SwatchColor[];
  /** Optional proportions (one per color) drawn as a bar above the chips, e.g. 60-30-10. */
  weights?: readonly number[];
  /** Caption above the chips; also the list's accessible name. */
  title?: string;
}

/** Normalize a {@link SwatchColor} into a chip, validating the value. */
function toChip(color: SwatchColor): Chip {
  const { name, value } = typeof color === "string" ? { name: undefined, value: color } : color;
  parseColor(value);
  return { css: value, name, label: value };
}

/** The shared figure: optional caption, optional proportion bar, then the chips. */
function ChipList({
  chips,
  title,
  weights,
  compact,
}: {
  chips: readonly Chip[];
  title?: string;
  weights?: readonly number[];
  compact?: boolean;
}) {
  const total = weights?.reduce((sum, w) => sum + w, 0) ?? 0;
  return (
    <figure className={compact ? "swatches swatches-compact" : "swatches"}>
      {title && <figcaption>{title}</figcaption>}
      {weights && (
        <div className="swatch-bar" aria-hidden="true">
          {chips.map((chip, i) => (
            <span key={i} style={{ background: chip.css, flexGrow: weights[i] }} />
          ))}
        </div>
      )}
      <ul aria-label={title ?? "Color swatches"}>
        {chips.map((chip, i) => (
          <li key={i}>
            <span className="swatch-chip" style={{ background: chip.css }} aria-hidden="true" />
            {chip.name && <span className="swatch-name">{chip.name}</span>}
            <span className="swatch-value">{chip.label}</span>
            {weights && (
              <span className="swatch-weight">{Math.round((weights[i]! / total) * 100)}%</span>
            )}
          </li>
        ))}
      </ul>
    </figure>
  );
}

/**
 * A row of color chips, each labeled with its name (if any) and value.
 *
 * @throws {Error} At build time for an unreadable color, or when `weights`
 *   doesn't have one non-negative entry per color with a positive total.
 */
export function Swatches({ colors, weights, title }: SwatchesProps) {
  if (weights && weights.length !== colors.length) {
    throw new Error(`<Swatches>: ${weights.length} weights for ${colors.length} colors`);
  }
  if (weights && (!weights.every((w) => Number.isFinite(w) && w >= 0) || !weights.some((w) => w > 0))) {
    throw new Error("<Swatches>: weights must be non-negative numbers with a positive total");
  }
  return <ChipList chips={colors.map(toChip)} title={title} weights={weights} />;
}

/** Props for {@link Scale}. */
interface ScaleProps {
  /** OKLCH hue in degrees. */
  hue: number;
  /** Target OKLCH chroma; reduced per step where needed to stay in sRGB. */
  chroma: number;
  /** Caption; also the list's accessible name. */
  title?: string;
}

/** An 11-step tonal scale (50–950) for one hue, computed at build time; chips show step and hex. */
export function Scale({ hue, chroma, title }: ScaleProps) {
  const chips = tonalScale(hue, chroma).map((s) => ({
    css: s.css,
    name: String(s.step),
    label: s.hex,
  }));
  return <ChipList chips={chips} title={title ?? `Scale: hue ${hue}, chroma ${chroma}`} compact />;
}

/** Props for {@link Contrast}. */
interface ContrastProps {
  /** Text color. */
  fg: string;
  /** Background color. */
  bg: string;
  /** Sample text; defaults to a pangram. */
  children?: ReactNode;
}

/** Normal-text grade: "AA large" means normal text fails. */
const textGrade = (level: WcagLevel) => (level === "AA large" ? "fail" : level);

/** Format a ratio the WCAG way: truncated, never rounded up past a threshold. */
const formatRatio = (ratio: number) => (Math.floor(ratio * 100) / 100).toFixed(2);

/**
 * Sample text in `fg` on `bg`, captioned with the WCAG 2 contrast ratio and its
 * grade for normal and large text.
 *
 * @throws {Error} At build time for an unreadable color.
 */
export function Contrast({ fg, bg, children }: ContrastProps) {
  const ratio = contrastRatio(parseColor(fg), parseColor(bg));
  return (
    <figure className="contrast">
      <div className="contrast-sample" style={{ color: fg, background: bg }}>
        {children ?? "The quick brown fox jumps over the lazy dog"}
      </div>
      <figcaption>
        <code>{fg}</code> on <code>{bg}</code> · {formatRatio(ratio)}:1 · text{" "}
        {textGrade(wcagLevel(ratio))} · large {wcagLevel(ratio, true)}
      </figcaption>
    </figure>
  );
}
