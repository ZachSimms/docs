/** Unit tests for index building and Markdown stripping in `lib/search.ts`. */
import path from "node:path";
import { describe, expect, it } from "bun:test";
import { buildSearchIndex, extractHeadings, stripMarkdown } from "@/lib/search";
import { isSearchIndex } from "@/lib/search-index-client";

const root = path.join(__dirname, "..", "fixtures", "content");
const topics = ["alpha", "beta"] as const;

describe("buildSearchIndex", () => {
  it("has one document per sheet with its url", () => {
    const docs = buildSearchIndex(topics, root);
    expect(docs.map((d) => d.url).sort()).toEqual([
      "/alpha/newest/",
      "/alpha/oldest/",
      "/alpha/rich/",
      "/beta/middle/",
    ]);
  });

  it("indexes sheets inside directories under their nested url", () => {
    const docs = buildSearchIndex(["epsilon"], root);
    expect(docs.map((d) => d.url)).toEqual([
      "/epsilon/grp/b/",
      "/epsilon/grp/a/",
      "/epsilon/loose/",
      "/epsilon/other/c/",
    ]);
    expect(docs.find((d) => d.slug === "a")?.headings).toEqual(["Alpha heading"]);
  });

  it("extracts headings and strips markdown from the body", () => {
    const rich = buildSearchIndex(topics, root).find((d) => d.slug === "rich")!;
    expect(rich.title).toBe("Rich sheet");
    expect(rich.headings).toEqual(["Kinematics"]);
    expect(rich.text).toContain("bold");
    expect(rich.text).toContain("inline code");
    expect(rich.text).toContain("link");
    expect(rich.text).toContain("velocity");
    expect(rich.text).not.toContain("**");
    expect(rich.text).not.toContain("](");
    expect(rich.text).not.toContain("should not be indexed");
    expect(rich.text).not.toContain("title:");
    expect(rich.text).not.toContain("|");
  });
});

describe("stripMarkdown", () => {
  it("reduces images and links to their text", () => {
    expect(stripMarkdown("see ![a chart](/images/c.png) and [docs](https://x.y)")).toBe(
      "see a chart and docs",
    );
  });

  it("removes list markers, emphasis and html", () => {
    expect(stripMarkdown("* one\n- two\n1. three <br/> ~~gone~~")).toBe("one two three gone");
  });
});

describe("extractHeadings", () => {
  it("returns heading text without markers, ignoring code fences", () => {
    const body = "# A\n\n```\n# not a heading\n```\n\n### B c\n";
    expect(extractHeadings(body)).toEqual(["A", "B c"]);
  });
});

describe("isSearchIndex", () => {
  it("accepts the built index and refuses malformed ones", () => {
    const doc = { topic: "t", slug: "s", title: "T", url: "/t/s/", headings: ["h"], text: "x" };
    expect(isSearchIndex([doc])).toBe(true);
    expect(isSearchIndex([])).toBe(true);
    for (const bad of [
      null,
      {},
      [null],
      [{ ...doc, title: 1 }],
      [{ ...doc, headings: "h" }],
      [{ ...doc, headings: [1] }],
      [{ topic: "t" }],
    ]) {
      expect(isSearchIndex(bad)).toBe(false);
    }
  });
});
