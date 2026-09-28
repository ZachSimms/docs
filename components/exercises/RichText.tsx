/**
 * @file Markdown with math, from the model, rendered safely in the page.
 *
 * Client component. `micromark` with GitHub-flavored Markdown and `$…$` / `$$…$$` math
 * (typeset by KaTeX), with raw HTML escaped and `javascript:` links dropped; the result
 * then goes through DOMPurify as well, since the text comes from a model that anyone's
 * request can steer. Links open in a new tab.
 */

"use client";

import { useMemo } from "react";
import createDOMPurify from "dompurify";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { math, mathHtml } from "micromark-extension-math";
import "katex/dist/katex.min.css";

let purifier: ReturnType<typeof createDOMPurify> | undefined;

/** One DOMPurify instance for the page, with links forced to open safely in a new tab. */
function purify(): ReturnType<typeof createDOMPurify> {
  if (purifier) return purifier;
  purifier = createDOMPurify(window);
  purifier.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.getAttribute("href")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
  return purifier;
}

/**
 * Put one-line display math (`$$x^2$$` alone on a line, as models usually write it) on
 * lines of its own, which is what makes it a centered block rather than inline math.
 */
export function displayMathBlocks(markdown: string): string {
  let fenced = false;
  return markdown
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) fenced = !fenced;
      const math = fenced ? null : /^([ \t]*)\$\$(.+?)\$\$[ \t]*$/.exec(line);
      return math ? `${math[1]}$$\n${math[1]}${math[2]}\n${math[1]}$$` : line;
    })
    .join("\n");
}

/**
 * Markdown (with math) to sanitized HTML.
 *
 * @param markdown - Untrusted Markdown.
 * @returns HTML that is safe to insert.
 */
export function renderRichText(markdown: string): string {
  const html = micromark(displayMathBlocks(markdown), {
    extensions: [gfm(), math()],
    htmlExtensions: [gfmHtml(), mathHtml({ throwOnError: false, output: "htmlAndMathml" })],
  });
  if (typeof window === "undefined") return "";
  return purify().sanitize(html, { USE_PROFILES: { html: true, mathMl: true } });
}

/** Props for {@link RichText}. */
interface RichTextProps {
  /** The Markdown source. */
  readonly text: string;
  /** Class for the wrapper. */
  readonly className?: string;
  /** Render inline (a `<span>`, without the paragraph). */
  readonly inline?: boolean;
}

/** Render model-written Markdown and math in the site's prose style. */
export function RichText({ text, className, inline = false }: RichTextProps) {
  const html = useMemo(() => {
    const rendered = renderRichText(text);
    // A single paragraph shown inline loses its <p> wrapper.
    const single = (rendered.match(/<p>/g) ?? []).length === 1;
    return inline && single ? rendered.replace(/^<p>([\s\S]*)<\/p>\s*$/, "$1") : rendered;
  }, [text, inline]);
  const Tag = inline ? "span" : "div";
  return (
    <Tag
      className={["rich", className].filter(Boolean).join(" ")}
      // Sanitized above: micromark escapes raw HTML and DOMPurify removes anything else.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
