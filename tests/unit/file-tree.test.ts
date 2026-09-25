/** Unit tests for `lib/file-tree.ts`: outline parsing and `tree`-style line drawing. */
import { describe, expect, it } from "bun:test";
import { drawTreeLine, parseTree, renderTreeLines } from "@/lib/file-tree";

const OUTLINE = `
repo/
  apps/
    web/            # Next.js app
      package.json
  packages/
    ui/
  pnpm-workspace.yaml
`;

/** The drawn lines as plain text, comments included, trailing spaces trimmed. */
const text = (source: string) => renderTreeLines(parseTree(source)).map(drawTreeLine);

describe("parseTree", () => {
  it("nests by two-space indentation and marks directories", () => {
    const [root] = parseTree(OUTLINE);
    expect(root?.name).toBe("repo/");
    expect(root?.isDir).toBe(true);
    expect(root?.children.map((c) => c.name)).toEqual(["apps/", "packages/", "pnpm-workspace.yaml"]);
    expect(root?.children[2]?.isDir).toBe(false);
    expect(root?.children[0]?.children[0]?.comment).toBe("Next.js app");
  });

  it("dedents an outline that is indented as a whole and skips blank lines", () => {
    const nodes = parseTree("\n    a/\n\n      b.ts\n    c.ts\n");
    expect(nodes.map((n) => n.name)).toEqual(["a/", "c.ts"]);
    expect(nodes[0]?.children.map((n) => n.name)).toEqual(["b.ts"]);
  });

  it("accepts a comment after a single space", () => {
    expect(parseTree("a.ts # note")[0]).toMatchObject({ name: "a.ts", comment: "note" });
  });

  it("keeps a # that is part of a name", () => {
    expect(parseTree("C#/\n  notes#1.md")[0]?.children[0]?.name).toBe("notes#1.md");
  });

  it("throws on odd indentation or a skipped level", () => {
    expect(() => parseTree("a/\n   b")).toThrow(/indent/i);
    expect(() => parseTree("a/\n    b")).toThrow(/level/i);
  });

  it("returns no nodes for an empty outline", () => {
    expect(parseTree("  \n\n")).toEqual([]);
  });
});

describe("renderTreeLines", () => {
  it("draws top-level entries bare and children with ├──, └── and │ guides", () => {
    expect(text(OUTLINE)).toEqual([
      "repo/",
      "├── apps/",
      "│   └── web/  # Next.js app",
      "│       └── package.json",
      "├── packages/",
      "│   └── ui/",
      "└── pnpm-workspace.yaml",
    ]);
  });

  it("aligns comments to one column", () => {
    const lines = renderTreeLines(parseTree("a.ts  # one\nlonger-name.ts  # two"));
    const ends = lines.map((l) => l.prefix.length + l.name.length + l.pad);
    expect(new Set(ends).size).toBe(1);
  });

  it("carries the directory flag through", () => {
    expect(renderTreeLines(parseTree("src/\n  x.ts")).map((l) => l.isDir)).toEqual([true, false]);
  });
});
