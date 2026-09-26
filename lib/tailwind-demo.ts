/**
 * @file Real Tailwind CSS for ```` ```html demo tailwind ```` snippets, compiled at build time.
 *
 * Server-only. The snippet's `<style>` blocks are moved into the compile input
 * (so `@theme`, `@utility` and custom `@keyframes` work), every class-like token
 * in the markup is offered to Tailwind as a candidate, and `build()` returns the
 * CSS for the ones that are real utilities (anything else is ignored). The demo
 * frame stays scriptless: the CSS is written into its `srcdoc`.
 *
 * `dark:` is keyed off `<html data-theme="dark">`, which `buildSrcDoc` sets from
 * the site theme, so dark variants follow the site toggle rather than the OS.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { compile } from "tailwindcss";

/** Makes `dark:` match the frame's `data-theme` attribute instead of `prefers-color-scheme`. */
const DARK_VARIANT = "@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *));";

/** Tailwind's own stylesheet; read from the project's node_modules (build cwd is the project root). */
const TAILWIND_CSS = path.join(process.cwd(), "node_modules", "tailwindcss", "index.css");

/** `<style …>…</style>` blocks, lazily. */
const STYLE_BLOCK = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;

/** Separators between candidate tokens: whitespace, quotes, angle brackets, `=` and backticks. */
const TOKEN_SEPARATOR = /[\s"'`<>=]+/;

/** At least one rule in the utilities layer of the compiled CSS. */
const UTILITIES = /@layer utilities \{\s*[.:@\[]/;

/** Tailwind's stylesheet text, read once per build. */
let tailwindCss: Promise<string> | undefined;

/** The markup of a demo snippet with its `<style>` blocks removed, and their CSS. */
export interface DemoParts {
  markup: string;
  css: string;
}

/**
 * Separate a snippet's `<style>` blocks from its markup.
 *
 * @param html - The fence body.
 * @returns The markup without styles, and the style contents joined by newlines.
 */
export function splitDemoStyles(html: string): DemoParts {
  const styles = [...html.matchAll(STYLE_BLOCK)].map((match) => (match[1] ?? "").trim());
  const markup = html.replace(STYLE_BLOCK, "").trim();
  return { markup, css: styles.join("\n") };
}

/**
 * Every class-like token in the markup, once each. Over-collecting is harmless:
 * Tailwind ignores tokens that aren't utilities.
 *
 * @param markup - HTML without style blocks.
 * @returns Unique candidate strings in first-seen order.
 */
export function extractCandidates(markup: string): string[] {
  return [...new Set(markup.split(TOKEN_SEPARATOR).filter(Boolean))];
}

/** Resolve `@import "tailwindcss"` (the only import demos use) to Tailwind's stylesheet. */
async function loadStylesheet(id: string, base: string) {
  if (id !== "tailwindcss") throw new Error(`Tailwind demo: unsupported @import "${id}"`);
  tailwindCss ??= readFile(TAILWIND_CSS, "utf8").catch((error: unknown) => {
    tailwindCss = undefined; // retry on the next demo
    throw error;
  });
  return { path: TAILWIND_CSS, base, content: await tailwindCss };
}

/**
 * Compile the Tailwind CSS a snippet needs.
 *
 * @param html - The fence body: markup, optionally with `<style>` blocks of Tailwind CSS.
 * @returns The markup to render and the compiled CSS (preflight, theme variables used, utilities).
 * @throws {Error} When the snippet's own CSS is invalid Tailwind, or when a snippet with
 *   classes compiles to no utilities at all (both surface as build errors).
 */
export async function compileTailwindDemo(html: string): Promise<DemoParts> {
  const { markup, css } = splitDemoStyles(html);
  // A fresh compiler per demo: build() is incremental, so a shared one would
  // hand every later demo the utilities of all the earlier ones.
  const input = `@import "tailwindcss";\n${DARK_VARIANT}\n${css}`;
  const compiler = await compile(input, { base: process.cwd(), loadStylesheet });
  const compiled = compiler.build(extractCandidates(markup));
  // A demo is written to show utilities: none at all means a broken setup or snippet, which
  // should fail the build instead of rendering an unstyled frame.
  if (/\bclass(?:Name)?=/.test(markup) && !UTILITIES.test(compiled)) {
    throw new Error(`Tailwind demo compiled no utilities for:\n${markup.slice(0, 200)}`);
  }
  return { markup, css: compiled };
}
