/**
 * @file Remark plugin: ```` ```tree ```` code fences become `<FileTree>` elements.
 *
 * Authors write a directory outline in a fence, where Markdown keeps every
 * space exactly:
 *
 * ````md
 * ```tree title="monorepo"
 * repo/
 *   apps/        # comment
 * ```
 * ````
 *
 * A template literal in a JSX attribute (`tree={`…`}`) is not safe for this:
 * MDX strips up to two leading spaces from each of its lines, which merges the
 * first two nesting levels. The fence is replaced by an MDX JSX element with a
 * plain string `tree` attribute (and `title` from the fence meta), rendered by
 * `components/FileTree.tsx` from the MDX component map.
 *
 * Loaded by name from `next.config.ts` (an absolute path to this file), so it
 * uses erasable TypeScript only (Node strips the types) and has no imports.
 */

/** The parts of an mdast/MDX node this plugin reads or writes. */
export interface MdNode {
  type: string;
  lang?: string | null;
  meta?: string | null;
  value?: string;
  name?: string;
  attributes?: { type: "mdxJsxAttribute"; name: string; value: string }[];
  children?: MdNode[];
  /** Source location; copied from the fence so MDX errors point at it. */
  position?: unknown;
}

/** Fence language that marks a file tree. */
const TREE_LANG = "tree";
/** `title="…"` in the fence meta. */
const TITLE = /title="([^"]*)"/;

/** Build the `<FileTree tree="…" title="…" />` element for a tree fence. */
function toFileTree(code: MdNode): MdNode {
  const title = TITLE.exec(code.meta ?? "")?.[1];
  return {
    type: "mdxJsxFlowElement",
    name: "FileTree",
    attributes: [
      { type: "mdxJsxAttribute", name: "tree", value: code.value ?? "" },
      ...(title ? [{ type: "mdxJsxAttribute" as const, name: "title", value: title }] : []),
    ],
    children: [],
    ...(code.position ? { position: code.position } : {}),
  };
}

/** Replace tree fences anywhere below `node`. */
function transform(node: MdNode): void {
  if (!node.children) return;
  node.children = node.children.map((child) =>
    child.type === "code" && child.lang === TREE_LANG ? toFileTree(child) : child,
  );
  node.children.forEach(transform);
}

/**
 * The unified plugin.
 *
 * @returns A transformer that rewrites ```` ```tree ```` fences in place.
 */
export default function remarkFileTree(): (tree: MdNode) => void {
  return transform;
}
