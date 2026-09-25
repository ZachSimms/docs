/** Unit tests for `lib/toc.ts`: ids must match what rehype-slug produces. */
import { describe, expect, it } from "bun:test";
import { extractToc, keepVisible, moreContent, parentOf, pickActive } from "@/lib/toc";

describe("extractToc", () => {
  it("returns ## and ### headings with rehype-slug compatible ids", () => {
    const body =
      "## 1.1 Solving equations\n\ntext\n\n### Third-level heading\n\n## Sets & functions\n";
    expect(extractToc(body)).toEqual([
      { id: "11-solving-equations", text: "1.1 Solving equations", depth: 2 },
      { id: "third-level-heading", text: "Third-level heading", depth: 3 },
      { id: "sets--functions", text: "Sets & functions", depth: 2 },
    ]);
  });

  it("ignores the h1, headings inside code fences, and strips inline markup", () => {
    const body =
      "# Title\n\n```\n## not a heading\n```\n\n## Use `code` and **bold** [link](/x/)\n";
    expect(extractToc(body)).toEqual([
      { id: "use-code-and-bold-link", text: "Use code and bold link", depth: 2 },
    ]);
  });

  it("suffixes duplicate headings like the rendered page does", () => {
    expect(extractToc("## Example\n\n## Example\n").map((e) => e.id)).toEqual([
      "example",
      "example-1",
    ]);
  });

  it("returns an empty list when there are no sub-headings", () => {
    expect(extractToc("Just a paragraph.")).toEqual([]);
  });
});

describe("pickActive", () => {
  it("is the first entry before any heading reaches the line", () => {
    expect(pickActive([300, 900, 1500], 100, false)).toBe(0);
  });

  it("is the last heading at or above the line", () => {
    expect(pickActive([-400, 80, 700], 100, false)).toBe(1);
    expect(pickActive([-900, -300, 100], 100, false)).toBe(2);
  });

  it("is the last entry once the page is scrolled to the bottom", () => {
    expect(pickActive([-900, 200, 500], 100, true)).toBe(2);
  });

  it("returns -1 when there are no headings", () => {
    expect(pickActive([], 100, false)).toBe(-1);
    expect(pickActive([], 100, true)).toBe(-1);
  });
});

describe("parentOf", () => {
  const entries = extractToc("## A\n\n### A1\n\n### A2\n\n## B\n\n### B1\n");

  it("is the nearest preceding ## for a ### entry", () => {
    expect(parentOf(entries, 2)).toBe(0);
    expect(parentOf(entries, 4)).toBe(3);
  });

  it("is -1 for ## entries, out-of-range indexes and orphan ###", () => {
    expect(parentOf(entries, 0)).toBe(-1);
    expect(parentOf(entries, 9)).toBe(-1);
    expect(parentOf(extractToc("### Orphan\n"), 0)).toBe(-1);
  });
});

describe("keepVisible", () => {
  it("leaves the scroll alone when the item is already in view", () => {
    expect(keepVisible({ top: 100, height: 20 }, { scrollTop: 50, height: 200 }, 10)).toBe(50);
  });

  it("scrolls up so an item above the view sits a margin below the top", () => {
    expect(keepVisible({ top: 30, height: 20 }, { scrollTop: 50, height: 200 }, 10)).toBe(20);
  });

  it("scrolls down so an item below the view sits a margin above the bottom", () => {
    expect(keepVisible({ top: 300, height: 20 }, { scrollTop: 50, height: 200 }, 10)).toBe(130);
  });

  it("never returns a negative offset", () => {
    expect(keepVisible({ top: 0, height: 20 }, { scrollTop: 40, height: 200 }, 10)).toBe(0);
  });
});

describe("moreContent", () => {
  it("reports nothing when everything fits", () => {
    expect(moreContent({ scrollTop: 0, height: 300, scrollHeight: 300 })).toEqual({
      up: false,
      down: false,
    });
  });

  it("reports content below at the top and above at the bottom", () => {
    expect(moreContent({ scrollTop: 0, height: 300, scrollHeight: 900 })).toEqual({
      up: false,
      down: true,
    });
    expect(moreContent({ scrollTop: 600, height: 300, scrollHeight: 900 })).toEqual({
      up: true,
      down: false,
    });
  });

  it("reports both in the middle and ignores sub-pixel remainders", () => {
    expect(moreContent({ scrollTop: 200, height: 300, scrollHeight: 900 })).toEqual({
      up: true,
      down: true,
    });
    expect(moreContent({ scrollTop: 599.5, height: 300, scrollHeight: 900 })).toEqual({
      up: true,
      down: false,
    });
  });
});
