/**
 * @file The home page's sky: tonight's moon in the light theme, the sun in the dark theme,
 * dithered on a canvas (see `lib/sky.ts`), with a two-line caption that names what is
 * shown and how to switch (`d`, the theme key).
 *
 * Client component: the moon's phase and the days to the next equinox or solstice are
 * worked out when the page is opened, not when it was built, for the reader's hemisphere
 * as told by their time zone (see `lib/hemisphere.ts`). Until the theme is known
 * after hydration the canvas is blank and the caption holds its space. Cells are
 * {@link CELL} CSS pixels, drawn at the device's resolution in the text color, and redrawn
 * when the theme changes.
 *
 * The body turns on its tilted axis once every {@link TURN} milliseconds, redrawn
 * {@link FPS} times a second while the figure is on screen. With reduced motion asked
 * for, it holds still at rest.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/useTheme";
import { hemisphereOf, localTimeZone, type Hemisphere } from "@/lib/hemisphere";
import { THEME_KEY } from "@/lib/keys";
import { moonBits, moonPhase, nextSeasonEvent, sunBits } from "@/lib/sky";

/** Size of one dither cell, in CSS pixels. */
const CELL = 3;
/** Cells across (and down) the drawing: 252 CSS pixels. */
const CELLS = 84;
/** One full turn of the sun or moon on its axis, in milliseconds. */
const TURN = 40_000;
/** Redraws a second while turning; the dither moves in whole cells, so more is wasted. */
const FPS = 15;
/** Frames in one turn. */
const STEPS = (TURN / 1000) * FPS;
/** Media query for readers who ask for less motion. */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** `rgb(r, g, b)` / `rgba(…)` to channels; black when unparsable. */
function channels(color: string): [number, number, number] {
  const [r = 0, g = 0, b = 0] = (color.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  return [r, g, b];
}

/**
 * Size `canvas` for the device and clear it; return a function that paints a square of
 * bits onto it in its text color, one bit per cell, or `null` without a 2D context.
 */
function painter(canvas: HTMLCanvasElement): ((bits: Uint8Array) => void) | null {
  const context = canvas.getContext("2d");
  const cells = document.createElement("canvas");
  const cellContext = cells.getContext("2d");
  if (!context || !cellContext) return null;
  const ratio = window.devicePixelRatio || 1;
  const side = Math.round(CELL * CELLS * ratio);
  canvas.width = side;
  canvas.height = side;
  cells.width = CELLS;
  cells.height = CELLS;
  const [r, g, b] = channels(getComputedStyle(canvas).color);
  const image = cellContext.createImageData(CELLS, CELLS);

  return (bits) => {
    image.data.fill(0);
    bits.forEach((bit, i) => {
      if (bit) image.data.set([r, g, b, 255], i * 4);
    });
    cellContext.putImageData(image, 0, 0);
    context.clearRect(0, 0, side, side);
    context.imageSmoothingEnabled = false;
    context.drawImage(cells, 0, 0, side, side);
  };
}

/** The caption's two lines for a theme, at `now`, seen from `hemisphere`. */
export function skyCaption(
  theme: "light" | "dark",
  now: Date,
  hemisphere: Hemisphere = "north",
): [string, string] {
  if (theme === "light") {
    const { name, illumination } = moonPhase(now);
    return [
      `${name}, ${Math.round(illumination * 100)}%`,
      `tonight's moon; ${THEME_KEY} for the sun`,
    ];
  }
  const { name, days } = nextSeasonEvent(now, hemisphere);
  const when = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return [`${name} ${when}`, `today's sun; ${THEME_KEY} for the moon`];
}

/** Render the figure: the canvas and its caption. */
export function SkyFigure() {
  const theme = useTheme();
  const ref = useRef<HTMLCanvasElement>(null);
  // The moment the page was opened; kept so a re-render doesn't redraw a different sky.
  const [now] = useState(() => new Date());
  // Read on the client when hydrating (state is not carried over from the server), so it
  // is the reader's time zone, not the build machine's.
  const [hemisphere] = useState(() => hemisphereOf(localTimeZone()));

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = painter(canvas);
    if (!paint || theme === null) return;
    const { age } = moonPhase(now);
    const draw = (spin: number) =>
      paint(theme === "light" ? moonBits(CELLS, age, hemisphere, spin) : sunBits(CELLS, spin));

    // Off screen there is nothing to see, so frames are skipped until it scrolls back.
    let visible = true;
    const observer =
      typeof IntersectionObserver === "function"
        ? new IntersectionObserver(([entry]) => {
            visible = entry?.isIntersecting ?? true;
          })
        : null;
    observer?.observe(canvas);

    const reduce =
      typeof window.matchMedia === "function" ? window.matchMedia(REDUCED_MOTION) : null;
    let frame = 0;
    const start = () => {
      cancelAnimationFrame(frame);
      draw(0);
      if (reduce?.matches) return;
      const began = performance.now();
      let shown = 0;
      const tick = (time: number) => {
        frame = requestAnimationFrame(tick);
        const step = Math.floor((Math.max(0, time - began) * FPS) / 1000);
        if (!visible || step === shown) return;
        shown = step;
        draw(((step % STEPS) / STEPS) * 2 * Math.PI);
      };
      frame = requestAnimationFrame(tick);
    };
    start();
    reduce?.addEventListener("change", start);
    return () => {
      cancelAnimationFrame(frame);
      reduce?.removeEventListener("change", start);
      observer?.disconnect();
    };
  }, [theme, now, hemisphere]);

  const [first, second] = theme ? skyCaption(theme, now, hemisphere) : ["\u00a0", "\u00a0"];
  return (
    <figure className="sky">
      <canvas ref={ref} aria-hidden="true" style={{ width: CELL * CELLS, height: CELL * CELLS }} />
      <figcaption className="dim">
        {first}
        <br />
        {second}
      </figcaption>
    </figure>
  );
}
