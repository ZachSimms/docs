/**
 * @file The home page's sky: the Earth turning and the Moon going round it, dithered on
 * a canvas (see `lib/earth-moon.ts`) in the text color, so they are light on dark in the
 * dark theme and dark on light in the light one.
 *
 * Client component. Until the theme is known after hydration the canvas is blank.
 * Cells are {@link CELL} CSS pixels, drawn at the device's resolution, and redrawn when
 * the theme changes. The rings and bands turn, redrawn {@link FPS} times a second while
 * the figure is on screen; with reduced motion asked for, the scene holds still.
 */

"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/useTheme";
import { skyBits } from "@/lib/earth-moon";

/** Size of one dither cell, in CSS pixels. */
const CELL = 1;
/**
 * Cells across and down the drawing: 320 × 172 CSS pixels, room for the Moon's orbit.
 * On a narrower screen it shrinks to fit, keeping its proportions.
 */
const COLUMNS = 320;
const ROWS = 172;
/** Redraws a second while turning: about a cell of movement a frame at the Earth's middle. */
const FPS = 20;
/** Media query for readers who ask for less motion. */
const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

/** `rgb(r, g, b)` / `rgba(…)` to channels; black when unparsable. */
function channels(color: string): [number, number, number] {
  const [r = 0, g = 0, b = 0] = (color.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  return [r, g, b];
}

/**
 * Size `canvas` for the device and clear it; return a function that paints a grid of
 * bits onto it in its text color, one bit per cell, or `null` without a 2D context.
 */
function painter(canvas: HTMLCanvasElement): ((bits: Uint8Array) => void) | null {
  const context = canvas.getContext("2d");
  const cells = document.createElement("canvas");
  const cellContext = cells.getContext("2d");
  if (!context || !cellContext) return null;
  const ratio = window.devicePixelRatio || 1;
  const width = Math.round(CELL * COLUMNS * ratio);
  const height = Math.round(CELL * ROWS * ratio);
  canvas.width = width;
  canvas.height = height;
  cells.width = COLUMNS;
  cells.height = ROWS;
  const [r, g, b] = channels(getComputedStyle(canvas).color);
  const image = cellContext.createImageData(COLUMNS, ROWS);

  return (bits) => {
    image.data.fill(0);
    bits.forEach((bit, i) => {
      if (bit) image.data.set([r, g, b, 255], i * 4);
    });
    cellContext.putImageData(image, 0, 0);
    context.clearRect(0, 0, width, height);
    context.imageSmoothingEnabled = false;
    context.drawImage(cells, 0, 0, width, height);
  };
}

/** Render the figure: the Earth and Moon's canvas. */
export function SkyFigure() {
  const theme = useTheme();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = painter(canvas);
    if (!paint || theme === null) return;
    const draw = (seconds: number) => paint(skyBits(COLUMNS, ROWS, seconds));

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
        draw(step / FPS);
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
  }, [theme]);

  return (
    <figure className="sky">
      <canvas
        ref={ref}
        aria-hidden="true"
        style={{ width: CELL * COLUMNS, aspectRatio: `${COLUMNS} / ${ROWS}` }}
      />
    </figure>
  );
}
