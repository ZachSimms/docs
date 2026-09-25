/**
 * @file Remark plugin: ```` ```html demo ```` fences also render live.
 *
 * Authors write an ordinary HTML fence (with a `<style>` block for the CSS)
 * and add `demo` to its meta, optionally with `height=180`:
 *
 * ````md
 * ```html demo height=160 title="flex.html"
 * <style>.row { display: flex; gap: 8px }</style>
 * <div class="row"><div>A</div><div>B</div></div>
 * ```
 * ````
 *
 * The code block stays (minus `demo` and `height=`, so rehype-pretty-code
 * still highlights it with its title and line ranges) and an MDX JSX
 * `<Demo html="…" />` element is inserted right after it, rendered by
 * `components/Demo.tsx`. A fence is used rather than a JSX attribute because
 * MDX strips leading spaces from multi-line attribute expressions.
 *
 * Loaded by absolute path from `next.config.ts`, so it uses erasable
 * TypeScript only and imports nothing at runtime.
 */

import type { MdNode } from "./remark-file-tree";

/** Fence language a demo must use. */
const DEMO_LANG = "html";
/** Bare `demo` word in the meta. */
const DEMO_WORD = /(^|\s)demo(?=\s|$)/;
/** `height=180` in the meta. */
const HEIGHT = /(^|\s)height=(\d+)(?=\s|$)/;
/** `title="…"` in the meta (kept on the code block too). */
const TITLE = /title="([^"]*)"/;

/** Quoted strings in the meta, blanked before looking for flags so `title="a demo"` isn't one. */
const QUOTED = /"[^"]*"/g;

/** The meta with quoted strings blanked out. */
const flagsOf = (meta: string | null | undefined) => (meta ?? "").replace(QUOTED, '""');

/** A `code` node that should become a demo. */
function isDemo(node: MdNode): boolean {
  return node.type === "code" && node.lang === DEMO_LANG && DEMO_WORD.test(flagsOf(node.meta));
}

/** One MDX string attribute. */
const attr = (name: string, value: string) => ({ type: "mdxJsxAttribute" as const, name, value });

/** The code block without the demo-only meta, and the `<Demo>` element that follows it. */
function expand(code: MdNode): MdNode[] {
  const meta = code.meta ?? "";
  const height = HEIGHT.exec(flagsOf(meta))?.[2];
  const title = TITLE.exec(meta)?.[1];
  // Drop the flags only outside quoted strings, so a title keeps its words.
  const rest = meta
    .split(/("[^"]*")/)
    .map((part, i) => (i % 2 ? part : part.replace(DEMO_WORD, " ").replace(HEIGHT, " ")))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  const demo: MdNode = {
    type: "mdxJsxFlowElement",
    name: "Demo",
    attributes: [
      attr("html", code.value ?? ""),
      ...(height ? [attr("height", height)] : []),
      ...(title ? [attr("title", title)] : []),
    ],
    children: [],
    ...(code.position ? { position: code.position } : {}),
  };
  return [{ ...code, meta: rest || null }, demo];
}

/** Expand demo fences anywhere below `node`. */
function transform(node: MdNode): void {
  if (!node.children) return;
  node.children = node.children.flatMap((child) => (isDemo(child) ? expand(child) : [child]));
  node.children.forEach(transform);
}

/**
 * The unified plugin.
 *
 * @returns A transformer that expands ```` ```html demo ```` fences in place.
 */
export default function remarkDemo(): (tree: MdNode) => void {
  return transform;
}
