/** Unit tests for `lib/remark-demo.ts`: ```html demo fences keep their code and gain a `<Demo>`. */
import { describe, expect, it } from "bun:test";
import remarkDemo from "@/lib/remark-demo";
import type { MdNode } from "@/lib/remark-file-tree";

/** A root holding the given children. */
const root = (...children: MdNode[]): MdNode => ({ type: "root", children });

/** Run the transform in place and return the tree. */
const run = (tree: MdNode) => {
  remarkDemo()(tree);
  return tree;
};

const value = '<div class="box">hi</div>';

describe("remarkDemo", () => {
  it("keeps the code block (without the demo words) and adds a Demo right after it", () => {
    const tree = run(
      root({ type: "code", lang: "html", meta: 'demo height=220 title="flex.html" {2}', value }),
    );
    expect(tree.children).toHaveLength(2);
    expect(tree.children?.[0]).toEqual({
      type: "code",
      lang: "html",
      meta: 'title="flex.html" {2}',
      value,
    });
    expect(tree.children?.[1]).toEqual({
      type: "mdxJsxFlowElement",
      name: "Demo",
      attributes: [
        { type: "mdxJsxAttribute", name: "html", value },
        { type: "mdxJsxAttribute", name: "height", value: "220" },
        { type: "mdxJsxAttribute", name: "title", value: "flex.html" },
      ],
      children: [],
    });
  });

  it("omits height and title when the fence has none", () => {
    const tree = run(root({ type: "code", lang: "html", meta: "demo", value }));
    expect(tree.children?.[0]?.meta).toBeNull();
    expect(tree.children?.[1]?.attributes).toEqual([
      { type: "mdxJsxAttribute", name: "html", value },
    ]);
  });

  it("finds demo fences nested in other nodes", () => {
    const tree = run(
      root({ type: "listItem", children: [{ type: "code", lang: "html", meta: "demo", value }] }),
    );
    expect(tree.children?.[0]?.children?.map((n) => n.type)).toEqual(["code", "mdxJsxFlowElement"]);
  });

  it("leaves other fences alone, including non-html ones that mention demo", () => {
    const fences: MdNode[] = [
      { type: "code", lang: "html", meta: 'title="demo.html"', value },
      { type: "code", lang: "css", meta: "demo", value: "a {}" },
      { type: "code", lang: "html", meta: null, value },
    ];
    const tree = run(root(...fences.map((f) => ({ ...f }))));
    expect(tree.children).toEqual(fences);
  });
});

describe("remarkDemo tailwind flag", () => {
  it("strips `tailwind` from the code meta and passes it to the Demo", () => {
    const tree = run(
      root({
        type: "code",
        lang: "html",
        meta: 'demo tailwind height=90 title="grid.html"',
        value,
      }),
    );
    expect(tree.children?.[0]?.meta).toBe('title="grid.html"');
    expect(tree.children?.[1]?.attributes).toEqual([
      { type: "mdxJsxAttribute", name: "html", value },
      { type: "mdxJsxAttribute", name: "height", value: "90" },
      { type: "mdxJsxAttribute", name: "title", value: "grid.html" },
      { type: "mdxJsxAttribute", name: "tailwind", value: "true" },
    ]);
  });

  it("ignores the word tailwind on fences that are not demos, and inside quotes", () => {
    const tree = run(
      root(
        { type: "code", lang: "html", meta: "tailwind", value },
        { type: "code", lang: "html", meta: 'demo title="tailwind grid"', value },
      ),
    );
    expect(tree.children?.[0]).toEqual({ type: "code", lang: "html", meta: "tailwind", value });
    expect(tree.children?.[1]?.meta).toBe('title="tailwind grid"');
    expect(tree.children?.[2]?.attributes?.map((a) => a.name)).toEqual(["html", "title"]);
  });
});

describe("remarkDemo flags inside quotes", () => {
  it("ignores demo and height words inside a quoted title", () => {
    const tree = run(
      root({ type: "code", lang: "html", meta: 'title="a demo height=9 page"', value }),
    );
    expect(tree.children).toHaveLength(1);
    expect(tree.children?.[0]?.meta).toBe('title="a demo height=9 page"');
  });

  it("keeps a quoted title intact when the fence is a demo", () => {
    const tree = run(root({ type: "code", lang: "html", meta: 'demo title="demo page"', value }));
    expect(tree.children?.[0]?.meta).toBe('title="demo page"');
    expect(tree.children?.[1]?.attributes?.at(-1)).toEqual({
      type: "mdxJsxAttribute",
      name: "title",
      value: "demo page",
    });
  });
});
