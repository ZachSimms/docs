/**
 * @file The home page's dither block (pattern in `lib/dither.ts`), drawn on a canvas.
 *
 * Client component. Each cell is {@link CELL} CSS pixels square and drawn at the device's
 * resolution, so the block stays crisp at any width; lit cells take the text color and
 * are redrawn when the theme changes. The field drifts slowly while the block is on
 * screen and the tab is visible, and stays still for readers who prefer reduced motion.
 * Decorative: hidden from screen readers.
 */

"use client";

import { useEffect, useRef } from "react";
import { ditherMask } from "@/lib/dither";

/** Size of one dither cell, in CSS pixels. */
const CELL = 3;
/** Frames per second of the drift. */
const FPS = 8;
/** How far the field drifts per frame. */
const STEP = 0.004;
/** The pattern's seed. */
const SEED = 7;

/** `rgb(r, g, b)` / `rgba(…)` to channels; black when unparsable. */
function channels(color: string): [number, number, number] {
  const [r = 0, g = 0, b = 0] = (color.match(/\d+(\.\d+)?/g) ?? []).map(Number);
  return [r, g, b];
}

/** Render the canvas and keep it drawn. */
export function DitherBlock() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const cells = document.createElement("canvas");
    const cellContext = cells.getContext("2d");
    if (!cellContext) return;

    let time = 0;
    const draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const columns = Math.max(1, Math.floor(width / CELL));
      const rows = Math.max(1, Math.floor(height / CELL));
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      cells.width = columns;
      cells.height = rows;

      const [r, g, b] = channels(getComputedStyle(canvas).color);
      const mask = ditherMask(columns, rows, time, SEED);
      const image = cellContext.createImageData(columns, rows);
      mask.forEach((lit, i) => {
        if (!lit) return;
        image.data.set([r, g, b, 255], i * 4);
      });
      cellContext.putImageData(image, 0, 0);

      context.imageSmoothingEnabled = false;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(cells, 0, 0, columns * CELL * ratio, rows * CELL * ratio);
    };
    draw();

    const resize = new ResizeObserver(draw);
    resize.observe(canvas);
    // Theme changes: the toggle sets <html data-theme>; the OS preference fires a media change.
    const theme = new MutationObserver(draw);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const dark = window.matchMedia?.("(prefers-color-scheme: dark)");
    dark?.addEventListener("change", draw);

    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let visible = false;
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
    });
    seen.observe(canvas);
    const timer = still
      ? undefined
      : window.setInterval(() => {
          if (!visible || document.hidden) return;
          time += STEP;
          draw();
        }, 1000 / FPS);

    return () => {
      resize.disconnect();
      theme.disconnect();
      seen.disconnect();
      dark?.removeEventListener("change", draw);
      window.clearInterval(timer);
    };
  }, []);

  return <canvas ref={ref} className="dither" aria-hidden="true" />;
}
