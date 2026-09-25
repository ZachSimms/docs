/** Unit tests for `lib/remark-file-tree.ts`: ```tree fences become `<FileTree>` elements. */
import { describe, expect, it } from "bun:test";
import remarkFileTree, { type MdNode } from "@/lib/remark-file-tree";

/** A root holding the given children. */
const root = (...children: MdNode[]): MdNode => ({ type: "root", children });

/** Run the transform in place and return the tree. */
const run = (tree: MdNode) => {
  remarkFileTree()(tree);
  return tree;
};

describe("remarkFileTree", () => {
  it("turns a tree fence into a FileTree element, keeping indentation exactly", () => {
    const value = "repo/\n  apps/\n    web/  # app";
    const tree = run(root({ type: "code", lang: "tree", meta: 'title="monorepo"', value }));
    expect(tree.children?.[0]).toEqual({
      type: "mdxJsxFlowElement",
      name: "FileTree",
      attributes: [
        { type: "mdxJsxAttribute", name: "tree", value },
        { type: "mdxJsxAttribute", name: "title", value: "monorepo" },
      ],
      children: [],
    });
  });

  it("omits the title when the fence has none", () => {
    const tree = run(root({ type: "code", lang: "tree", meta: null, value: "a/" }));
    const element = tree.children?.[0] as { attributes: { name: string }[] };
    expect(element.attributes.map((a) => a.name)).toEqual(["tree"]);
  });

  it("finds fences nested inside other nodes and leaves other code alone", () => {
    const ts = { type: "code", lang: "ts", meta: null, value: "let a = 1;" };
    const nested = { type: "code", lang: "tree", meta: null, value: "x/" };
    const tree = run(root(ts, { type: "blockquote", children: [nested] }));
    expect(tree.children?.[0]).toBe(ts);
    expect(tree.children?.[1]?.children?.[0]?.type).toBe("mdxJsxFlowElement");
  });
});
