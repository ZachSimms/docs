/**
 * @file Build-time loading of the site's SVG diagrams for `<Diagram>`.
 *
 * Diagrams are inlined (not `<img>`) so they can use `currentColor` and the
 * site's CSS variables and follow the theme. Only repo-owned `.svg` files under
 * `public/images/diagrams/` are read. The file is parsed with parse5 (the HTML
 * spec's parser, so exactly as the browser will read the inlined markup) and the
 * tree is checked against an allowlist of static SVG elements and presentation
 * attributes: no scripts, handlers, links, animation, `style`, HTML (which would
 * break out of the `<svg>`) or external references, and ids must carry the
 * file's name as a prefix (`box-model.svg` may use `id="box-model-…"`). The
 * checked tree is serialized back, so what was checked is what is inlined.
 */

import fs from "node:fs";
import path from "node:path";
import { parseFragment, serializeOuter, type DefaultTreeAdapterMap } from "parse5";
import { cache } from "react";
import { PUBLIC_ROOT } from "@/lib/images";

/** URL folder every diagram must live in. */
export const DIAGRAM_DIR = "/images/diagrams/";

/** The SVG namespace: every element of a diagram must stay in it. */
const SVG_NS = "http://www.w3.org/2000/svg";

/**
 * Static SVG elements a diagram may use. Anything else is refused: scripts,
 * `foreignObject`, `<style>`, links, animation (`<set>`/`<animate>` can rewrite
 * attributes), and every HTML element (which would break out of the `<svg>`).
 */
// prettier-ignore
const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "defs", "symbol", "use", "marker", "title", "desc",
  "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "textPath",
  "linearGradient", "radialGradient", "stop", "pattern", "clipPath", "mask",
]);

/**
 * Attributes a diagram may use: geometry and presentation, never handlers or
 * `style` (page-wide effects such as `position: fixed`).
 */
// prettier-ignore
const ALLOWED_ATTRIBUTES = new Set([
  "xmlns", "xmlns:xlink", "viewBox", "preserveAspectRatio", "role", "aria-hidden", "aria-label",
  "focusable", "id", "class", "transform", "href", "xlink:href",
  "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy", "d", "points",
  "width", "height", "dx", "dy", "rotate", "textLength", "lengthAdjust", "startOffset",
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-dasharray",
  "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity",
  "opacity", "visibility", "display", "vector-effect", "paint-order",
  "font-family", "font-size", "font-style", "font-weight", "letter-spacing", "text-anchor",
  "dominant-baseline", "alignment-baseline", "baseline-shift",
  "marker-start", "marker-mid", "marker-end", "refX", "refY", "markerWidth", "markerHeight",
  "markerUnits", "orient", "offset", "stop-color", "stop-opacity", "gradientUnits",
  "gradientTransform", "spreadMethod", "patternUnits", "patternContentUnits", "patternTransform",
  "clip-path", "clip-rule", "clipPathUnits", "mask", "maskUnits", "maskContentUnits",
]);

/** `href` values may only point inside the document (`#arrow`); nothing is fetched or navigated to. */
const LOCAL_HREF = /^#[\w-]+$/;

/** A `url(…)` reference in a value (`marker-end="url(#arrow)"`); only local ones are allowed. */
const URL_REF = /url\s*\(/i;
const LOCAL_URL_REF = /^url\(#[\w-]+\)$/;

/** XML prolog, doctype and comments before the root element. */
const PREAMBLE = /^(?:\s*(?:<\?xml[^>]*\?>|<!DOCTYPE[^>]*>|<!--[\s\S]*?-->))*\s*/i;

/** A parsed element. */
type Element = DefaultTreeAdapterMap["element"];

/** A parsed node of any kind. */
type Node = DefaultTreeAdapterMap["node"];

/** An attribute's qualified name, `xlink:href` included. */
function attributeName(attr: Element["attrs"][number]): string {
  return attr.prefix ? `${attr.prefix}:${attr.name}` : attr.name;
}

/**
 * Why an attribute is refused, or `null` when it is allowed.
 *
 * Values are checked after the parser has decoded character references, so
 * `javascript&colon;` or `&#106;` can't hide anything.
 */
function unsafeAttribute(attr: Element["attrs"][number]): string | null {
  const name = attributeName(attr);
  if (!ALLOWED_ATTRIBUTES.has(name)) return `attribute "${name}"`;
  if ((name === "href" || name === "xlink:href") && !LOCAL_HREF.test(attr.value.trim())) {
    return `${name}="${attr.value}"`;
  }
  if (URL_REF.test(attr.value) && !LOCAL_URL_REF.test(attr.value.trim())) {
    return `${name}="${attr.value}"`;
  }
  return null;
}

/** Every element under `node` (itself included), depth first. */
function* elements(node: Node): Generator<Element> {
  if ("tagName" in node) yield node;
  if ("childNodes" in node) for (const child of node.childNodes) yield* elements(child);
}

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
  if (
    !publicPath.startsWith(DIAGRAM_DIR) ||
    !publicPath.endsWith(".svg") ||
    publicPath.split("/").includes("..")
  ) {
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
  // Parse exactly as the browser will when the markup is inlined into <body>, then
  // check the tree (not the text) and emit that same tree: what was checked is what ships.
  const fragment = parseFragment(source.replace(PREAMBLE, ""));
  const roots = fragment.childNodes.filter(
    (node) => node.nodeName !== "#comment" && !("value" in node && !node.value.trim()),
  );
  const root = roots[0];
  if (roots.length !== 1 || !root || !("tagName" in root) || root.tagName !== "svg") {
    // A second top-level node here is HTML that broke out of the <svg>, e.g. `<svg><p>…`.
    throw new Error(
      roots.length > 1 && root && "tagName" in root && root.tagName === "svg"
        ? `Diagram "${publicPath}" contains unsafe markup (HTML outside the <svg>)`
        : `Diagram "${publicPath}" is not an SVG`,
    );
  }
  const all = [...elements(root)];
  for (const element of all) {
    if (element.namespaceURI !== SVG_NS || !ALLOWED_ELEMENTS.has(element.tagName)) {
      throw new Error(`Diagram "${publicPath}" contains unsafe markup: <${element.tagName}>`);
    }
    for (const attr of element.attrs) {
      const problem = unsafeAttribute(attr);
      if (problem) throw new Error(`Diagram "${publicPath}" contains unsafe markup: ${problem}`);
    }
  }
  const prefix = `${path.basename(publicPath, ".svg")}-`;
  const stray = all
    .flatMap((element) => element.attrs.filter((attr) => attributeName(attr) === "id"))
    .map((attr) => attr.value)
    .filter((id) => !id.startsWith(prefix));
  if (stray.length > 0) {
    throw new Error(
      `Diagram "${publicPath}" has ids without the "${prefix}" prefix: ${stray.join(", ")}`,
    );
  }
  return serializeOuter(root);
});
