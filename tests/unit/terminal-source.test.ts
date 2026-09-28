/** Unit tests for `lib/terminal/source.ts` and `lib/terminal/markdown-lines.ts`. */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "bun:test";
import { classifyLines } from "@/lib/terminal/markdown-lines";
import {
  groupSourceHref,
  listSources,
  postSourceHref,
  readSource,
  sheetSourceHref,
} from "@/lib/terminal/source";

const fixtures = path.join(__dirname, "..", "fixtures");
const roots = {
  content: path.join(fixtures, "content"),
  posts: path.join(fixtures, "posts"),
  topics: ["alpha", "epsilon"],
};

describe("source URLs", () => {
  it("mirror the page's path, ending in .md", () => {
    expect(sheetSourceHref({ topic: "python", slug: "overview" })).toBe(
      "/source/python/overview.md",
    );
    expect(sheetSourceHref({ topic: "python", group: "language", slug: "oop" })).toBe(
      "/source/python/language/oop.md",
    );
    expect(groupSourceHref({ topic: "python", slug: "language" })).toBe(
      "/source/python/language/index.md",
    );
    expect(postSourceHref({ slug: "hello" })).toBe("/source/blog/hello.md");
  });
});

describe("listSources", () => {
  const sources = listSources(roots);
  const paths = sources.map((source) => source.segments.join("/"));

  it("lists sheets, directory intros and posts, never drafts or partials", () => {
    expect(paths).toContain("alpha/newest.md");
    expect(paths).toContain("epsilon/grp/a.md");
    expect(paths).toContain("epsilon/grp/index.md");
    expect(paths).toContain("epsilon/empty/index.md");
    expect(paths).toContain("blog/hello-world.md");
    expect(paths.some((p) => p.includes("_"))).toBe(false);
    expect(paths.every((p) => p.endsWith(".md"))).toBe(true);
  });

  it("points every source at a file that exists", () => {
    expect(sources.every((source) => fs.existsSync(source.file))).toBe(true);
  });
});

describe("readSource", () => {
  it("returns a listed source as written, frontmatter included", () => {
    const text = readSource(["epsilon", "grp", "a.md"], roots);
    expect(text).toStartWith("---\ntitle: A sheet");
  });

  it("reads nothing that is not a listed source", () => {
    expect(readSource(["alpha", "_partial.md"], roots)).toBeUndefined();
    expect(readSource(["..", "..", "package.json"], roots)).toBeUndefined();
    expect(readSource(["alpha", "newest.mdx"], roots)).toBeUndefined();
  });
});

describe("classifyLines", () => {
  it("marks frontmatter, imports, headings, fences, code and components", () => {
    const source = [
      "---",
      "title: X",
      "---",
      'import Part from "./_part.mdx"',
      "",
      "## Heading",
      "Text with # not a heading",
      "````md",
      "# a comment, not a heading",
      "```python",
      "````",
      '<Note kind="tip">',
      "~~~",
      "code",
      "~~~",
      "",
    ].join("\n");
    expect(classifyLines(source).map((line) => line.kind)).toEqual([
      "meta",
      "meta",
      "meta",
      "meta",
      "text",
      "heading",
      "text",
      "fence",
      "code",
      "code",
      "fence",
      "jsx",
      "fence",
      "code",
      "fence",
    ]);
  });

  it("keeps the text, normalizing Windows line ends", () => {
    expect(classifyLines("a\r\nb")).toEqual([
      { text: "a", kind: "text" },
      { text: "b", kind: "text" },
    ]);
  });
});
