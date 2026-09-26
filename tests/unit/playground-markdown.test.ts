/** Unit tests for `lib/playground/markdown.ts`: GFM rendering with raw HTML and dangerous links neutralized. */
import { describe, expect, it } from "bun:test";
import { buildMarkdownSrcDoc, renderMarkdown } from "@/lib/playground/markdown";

describe("renderMarkdown", () => {
  it("renders GitHub-flavored tables, task lists and strikethrough", () => {
    const html = renderMarkdown(
      "| a | b |\n| - | - |\n| 1 | 2 |\n\n- [x] done\n- [ ] todo\n\n~~old~~",
    );
    expect(html).toContain("<table>");
    expect(html).toContain("<td>1</td>");
    expect(html).toContain('<input type="checkbox" disabled="" checked="" />');
    expect(html).toContain("<del>old</del>");
  });

  it("escapes raw HTML and drops javascript: links", () => {
    const html = renderMarkdown(
      "<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))",
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("javascript:");
  });
});

describe("buildMarkdownSrcDoc", () => {
  it("wraps the HTML in a themed document whose links can't navigate", () => {
    const doc = buildMarkdownSrcDoc("# Hi", "dark");
    expect(doc).toContain("color-scheme: dark;");
    expect(doc).toContain('<base target="_blank">');
    expect(doc).toContain("<h1>Hi</h1>");
  });
});
