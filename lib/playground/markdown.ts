/**
 * @file Markdown → HTML for the playground's preview.
 *
 * `micromark` with GitHub-flavored Markdown (tables, task lists,
 * strikethrough, autolinks, footnotes). Raw HTML in the source is escaped,
 * not rendered, and `javascript:` style links are dropped
 * (`allowDangerousHtml`/`allowDangerousProtocol` stay off). The result is
 * shown in an `<iframe sandbox="">` (no scripts), so even a renderer bug
 * can't run code.
 */

import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import type { Theme } from "@/lib/theme";

/**
 * Render Markdown to HTML.
 *
 * @param markdown - The source.
 * @returns Safe HTML (raw HTML in the source is escaped).
 */
export function renderMarkdown(markdown: string): string {
  return micromark(markdown, { extensions: [gfm()], htmlExtensions: [gfmHtml()] });
}

/** Styles for the preview document, following the site's look and theme. */
const PREVIEW_CSS = `
  --bg: light-dark(#f2f2f2, #161616);
  --fg: light-dark(#000, #e6e6e6);
  --chip: light-dark(#ddd, #333);
  --rule: light-dark(#d5d5d5, #333);
  --link: light-dark(#1f6feb, #58a6ff);
}
* { box-sizing: border-box; }
body { margin: 1rem 1.25rem; background: var(--bg); color: var(--fg); font: 15px/1.55 monospace; }
h1, h2, h3, h4 { font-size: 1em; font-weight: bold; margin: 1.4em 0 0.5em; }
h1 { font-size: 1.15em; }
p, ul, ol, table, pre, blockquote { margin: 0 0 1em; }
ul, ol { padding-left: 3ch; }
li:has(> input[type="checkbox"]) { list-style: none; margin-left: -3ch; }
a { color: var(--link); }
code { background: var(--chip); padding: 0 3px; }
pre { background: var(--chip); padding: 0.75em; overflow: auto; }
pre code { background: none; padding: 0; }
table { border-collapse: collapse; display: block; overflow-x: auto; }
th, td { text-align: left; padding: 0.2em 1.5ch 0.2em 0; border-bottom: 1px dotted var(--rule); }
blockquote { border-left: 1px dotted currentColor; padding-left: 1.5ch; margin-left: 0; }
hr { border: 0; border-top: 1px dotted currentColor; }
img { max-width: 100%; }
del { opacity: 0.7; }`;

/**
 * The preview document for `<iframe sandbox="" srcdoc>`.
 *
 * @param markdown - The source to render.
 * @param theme - The site theme, or `null` for the OS preference.
 */
export function buildMarkdownSrcDoc(markdown: string, theme: Theme | null): string {
  const scheme = theme ?? "light dark";
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>:root {\n  color-scheme: ${scheme};${PREVIEW_CSS}</style></head><body>${renderMarkdown(markdown)}</body></html>`;
}
