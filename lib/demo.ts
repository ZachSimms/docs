/**
 * @file The document a live `<Demo>` frame shows: the snippet plus base styles.
 *
 * Pure and shared by the server `Demo` and the client `DemoFrame`. A `srcdoc`
 * frame takes its preferred colour scheme from the OS, not from the page, so
 * the frame's `color-scheme` is written into the document: `light dark` (the
 * OS preference) on the server, then the site's resolved theme once the
 * client knows it. The site's colour tokens resolve through `light-dark()`.
 *
 * Links and forms in a snippet resolve against the parent page's URL (even
 * `href="#"`), so a click would load the site inside the frame. `<base
 * target="_blank">` sends every navigation to a new window, which the
 * sandbox (no `allow-popups`) blocks: links stay inert but keep `:hover`.
 */

import type { Theme } from "@/lib/theme";

/** Frame height in CSS pixels when the fence doesn't give `height=`. */
export const DEFAULT_DEMO_HEIGHT = 160;

/** Base styles for every demo document, after the `color-scheme` line. */
const BASE_CSS = `
  --bg: light-dark(#f2f2f2, #161616);
  --fg: light-dark(#000, #e6e6e6);
  --chip: light-dark(#ddd, #333);
  --muted: light-dark(#666, #999);
  --graph-0: light-dark(#1f6feb, #58a6ff);
  --graph-1: light-dark(#cf222e, #ff7b72);
  --graph-2: light-dark(#1a7f37, #3fb950);
  --graph-3: light-dark(#8250df, #d2a8ff);
}
* { box-sizing: border-box; }
body {
  margin: 12px;
  background: var(--bg);
  color: var(--fg);
  font: 14px/1.4 system-ui, sans-serif;
}`;

/**
 * Wrap a snippet in a complete document with the base styles.
 *
 * @param html - The fence's content (markup plus any `<style>`).
 * @param theme - The site theme, or `null` to follow the OS (`light dark`).
 * @returns The `srcdoc` string.
 */
export function buildSrcDoc(html: string, theme: Theme | null = null): string {
  const scheme = theme ?? "light dark";
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>:root {\n  color-scheme: ${scheme};${BASE_CSS}</style></head><body>${html}</body></html>`;
}
