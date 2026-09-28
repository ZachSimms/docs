/** Unit tests for `lib/terminal/page-text.ts`: a page as terminal text, and its headings. */
import { describe, expect, it } from "bun:test";
import { pageHeadings, pageText, parseMain } from "@/lib/terminal/page-text";

/** A `<main>` holding `html`. */
function main(html: string): Element {
  const el = document.createElement("main");
  el.innerHTML = html;
  return el;
}

describe("pageText", () => {
  it("prints headings with their markers and paragraphs with blank lines between", () => {
    const text = pageText(
      main(`<nav class="crumbs"><a href="/docs/">docs</a> / python</nav>
        <h1>Python</h1><p>Some   <strong>bold</strong>
        text.</p><h2 id="lists">Lists</h2><p>More.</p>`),
    );
    expect(text).toEqual(["# Python", "", "Some bold text.", "", "## Lists", "", "More."]);
  });

  it("marks list items, numbering ordered lists from their start", () => {
    const text = pageText(
      main(`<ul><li>one</li><li>two <em>2</em></li></ul><ol start="3"><li>c</li><li>d</li></ol>`),
    );
    expect(text).toEqual(["- one", "- two 2", "", "3. c", "4. d"]);
  });

  it("keeps code lines and indents them", () => {
    const text = pageText(
      main(`<p>Code:</p><pre><code>def f():\n    return 1\n</code></pre><p>After.</p>`),
    );
    expect(text).toEqual(["Code:", "", "  def f():", "      return 1", "", "After."]);
  });

  it("prints tables as rows of cells, and rules, breaks and images", () => {
    const text = pageText(
      main(`<table><thead><tr><th>a</th><th>b</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>
        <hr><p>line<br>next <img alt="a cat" src="x.png"><img src="y.png"></p>`),
    );
    expect(text).toEqual(["a | b", "1 | 2", "", "-", "", "line", "next [image: a cat]"]);
  });

  it("quotes blockquotes", () => {
    expect(pageText(main(`<blockquote><p>wise</p><p>words</p></blockquote><p>after</p>`))).toEqual([
      "> wise",
      ">",
      "> words",
      "",
      "after",
    ]);
  });

  it("prints math as its LaTeX source, once", () => {
    const text = pageText(
      main(`<p>Inline <span class="katex"><span class="katex-mathml"><math><semantics><mi>x</mi>
        <annotation encoding="application/x-tex">x^2</annotation></semantics></math></span>
        <span class="katex-html" aria-hidden="true">x2</span></span> here.</p>
        <span class="katex-display"><span class="katex"><span class="katex-html">E=mc2</span></span></span>`),
    );
    expect(text).toEqual(["Inline $x^2$ here.", "", "$$E=mc2$$"]);
  });

  it("leaves out what the page hides: other tabs, screen-reader notes, buttons, scripts", () => {
    const text = pageText(
      main(`<div role="tabpanel">shown</div><div role="tabpanel" hidden>other tab</div>
        <p><a href="https://x.y">link<span class="sr-only"> (opens in a new tab)</span></a></p>
        <button>copy</button><script>alert(1)</script><svg><text>chart</text></svg>`),
    );
    expect(text).toEqual(["shown", "link"]);
  });
});

describe("pageHeadings", () => {
  it("lists ## and ### headings that have ids", () => {
    const headings = pageHeadings(
      main(
        `<h1 id="t">T</h1><h2 id="a">A <code>x</code></h2><h3 id="b">B</h3><h2>no id</h2><h4 id="c">C</h4>`,
      ),
    );
    expect(headings).toEqual([
      { id: "a", text: "A x", level: 2 },
      { id: "b", text: "B", level: 3 },
    ]);
  });
});

describe("parseMain", () => {
  it("finds the <main> of a fetched page", () => {
    expect(
      parseMain(`<html><body><aside>nav</aside><main><h1>Hi</h1></main></body></html>`)
        ?.textContent,
    ).toBe("Hi");
    expect(parseMain(`<p>no main</p>`)).toBeNull();
  });
});
