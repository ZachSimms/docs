/**
 * @file Build-time loading of the site's SVG diagrams for `<Diagram>`.
 *
 * Diagrams are inlined (not `<img>`) so they can use `currentColor` and the
 * site's CSS variables and follow the theme. Only repo-owned `.svg` files under
 * `public/images/diagrams/` are read. Inside tags, markup that could run code
 * (scripts, `on*` handlers, `javascript:` URLs, character references that could
 * hide either, embedded HTML) is refused, and so is anything that would leak
 * into the page once inlined: `<style>` blocks and ids not prefixed with the
 * file's name (`box-model.svg` may use `id="box-model-…"`).
 */

import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { PUBLIC_ROOT } from "@/lib/images";

/** URL folder every diagram must live in. */
export const DIAGRAM_DIR = "/images/diagrams/";

/** Elements refused anywhere: code, embedded HTML, and page-wide styles. */
const UNSAFE_ELEMENTS = /<\s*(?:script|foreignObject|style|iframe|embed|object)\b/i;

/**
 * Every tag (element with its attributes), where handlers and URLs live. Quoted
 * attribute values may contain `>`, so they are matched whole: a naive `<[^>]*>`
 * would end the tag early and let `<a title=">" href="javascript:…">` through.
 */
const TAG = /<(?:[^>"']|"[^"]*"|'[^']*')*>/g;

/**
 * Inside a tag: an event handler, a `javascript:` URL (whitespace-split too), or
 * a character reference other than the five XML ones. The HTML parser decodes
 * named references in inlined SVG attributes too, so `javascript&colon;` or
 * `java&Tab;script:` would hide a URL as well as `&#58;` does.
 */
const UNSAFE_IN_TAG = [
  /[\s"'/]on[a-z]+\s*=/i,
  /j\s*a\s*v\s*a\s*s\s*c\s*r\s*i\s*p\s*t\s*:/i,
  /&(?!(?:amp|lt|gt|quot|apos);)/,
];

/** `id="…"` attributes, whose values must carry the file-name prefix. */
const ID = /[\s"'/]id\s*=\s*["']([^"']*)["']/gi;

/** XML prolog, doctype and comments before the root element. */
const PREAMBLE = /^(?:\s*(?:<\?xml[^>]*\?>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->))*\s*/i;

/**
 * Read a diagram and return its `<svg>` markup, ready to inline.
 *
 * Memoised per render with React `cache`.
 *
 * @param publicPath - URL path such as `"/images/diagrams/box-model.svg"`.
 * @param publicRoot - Folder the path is resolved against; overridable for tests.
 * @returns The markup starting at `<svg`.
 * @throws {Error} For paths outside the folder, non-SVG or unreadable files, or unsafe markup.
 */
export const readDiagram = cache((publicPath: string, publicRoot: string = PUBLIC_ROOT): string => {
  if (!publicPath.startsWith(DIAGRAM_DIR) || !publicPath.endsWith(".svg") || publicPath.split("/").includes("..")) {
    throw new Error(`Diagram "${publicPath}" must be an .svg file under ${DIAGRAM_DIR}`);
  }
  let source: string;
  try {
    const dir = fs.realpathSync(path.join(publicRoot, DIAGRAM_DIR));
    const file = fs.realpathSync(path.join(publicRoot, publicPath));
    if (!file.startsWith(dir + path.sep)) throw new Error("outside the diagrams folder");
    source = fs.readFileSync(file, "utf8");
  } catch (error) {
    throw new Error(`Cannot read diagram "${publicPath}": ${(error as Error).message}`);
  }
  const svg = source.replace(PREAMBLE, "").trim();
  if (!svg.startsWith("<svg")) throw new Error(`Diagram "${publicPath}" is not an SVG`);
  const tags = svg.match(TAG) ?? [];
  if (UNSAFE_ELEMENTS.test(svg) || tags.some((tag) => UNSAFE_IN_TAG.some((re) => re.test(tag)))) {
    throw new Error(`Diagram "${publicPath}" contains unsafe markup (scripts, handlers, styles or HTML)`);
  }
  const prefix = `${path.basename(publicPath, ".svg")}-`;
  const stray = tags.flatMap((tag) => [...tag.matchAll(ID)].map((m) => m[1] ?? ""))
    .filter((id) => !id.startsWith(prefix));
  if (stray.length > 0) {
    throw new Error(`Diagram "${publicPath}" has ids without the "${prefix}" prefix: ${stray.join(", ")}`);
  }
  return svg;
});
