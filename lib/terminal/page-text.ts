/**
 * @file A rendered page as terminal text: what `cat` prints and the headings `toc` lists.
 *
 * Works on any DOM tree (the live page, or one parsed from a fetched page with
 * `DOMParser`), and reads it without laying it out, so it behaves the same in tests.
 * What the page hides stays hidden: the other panels of a `<Tabs>`, screen-reader-only
 * notes, the breadcrumb trail.
 * The result is plain lines: headings keep their `#` markers, list items get `-` or
 * their number, code blocks keep their lines, tables become `a | b` rows, and KaTeX
 * math prints its LaTeX source between `$`.
 */

/** A heading of a page that can be jumped to. */
export interface Heading {
  /** The element's `id` (set by rehype-slug), without `#`. */
  readonly id: string;
  readonly text: string;
  /** 2 for `##`, 3 for `###`. */
  readonly level: number;
}

/** Elements whose text is never page content. */
const SKIPPED = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "SVG",
  "BUTTON",
  "IFRAME",
  "CANVAS",
]);

/** Chrome inside `<main>` that is not the page's content: the breadcrumb trail. */
const SKIPPED_CLASSES = ["crumbs", "sr-only"];

/** Elements that start and end a line of their own. */
const BLOCKS = new Set([
  "P",
  "DIV",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FIGURE",
  "FIGCAPTION",
  "BLOCKQUOTE",
  "DETAILS",
  "SUMMARY",
  "DL",
  "DT",
  "DD",
  "UL",
  "OL",
  "TABLE",
  "ASIDE",
  "MAIN",
  "FOOTER",
  "HR",
  "NAV",
]);

/** Blocks followed by a blank line, like paragraphs in Markdown. */
const SPACED = new Set([
  "P",
  "UL",
  "OL",
  "TABLE",
  "BLOCKQUOTE",
  "FIGURE",
  "DETAILS",
  "DL",
  "ASIDE",
  "HR",
]);

/** Collapse runs of whitespace, as the browser renders inline text. */
function squash(text: string): string {
  return text.replace(/\s+/g, " ");
}

/** Builds lines from inline text and block boundaries. */
class Lines {
  readonly out: string[] = [];
  private current = "";
  private gap = false;
  /** Prefix for new lines inside a blockquote. */
  quote = "";

  /** Add inline text to the line being built. */
  text(value: string): void {
    const text = squash(value);
    if (this.current === "" && text.trim() === "") return;
    this.current += this.current === "" ? text.trimStart() : text;
  }

  /** Finish the line being built, if it has anything. */
  flush(): void {
    const line = this.current.trimEnd();
    this.current = "";
    if (line === "") return;
    this.line(line);
  }

  /** Emit a whole line (a code line keeps its spaces). */
  line(value: string): void {
    // Inside a blockquote the blank line keeps its `>`, as Markdown writes it.
    if (this.gap && this.out.length > 0) this.out.push(this.quote.trimEnd());
    this.gap = false;
    this.out.push(`${this.quote}${value}`);
  }

  /** Ask for a blank line before the next content. */
  space(): void {
    this.flush();
    this.gap = true;
  }
}

/** KaTeX renders math twice (MathML and HTML); print the LaTeX source once instead. */
function mathText(el: Element): string {
  const tex = el.querySelector("annotation")?.textContent?.trim();
  const display = el.parentElement?.classList.contains("katex-display") ?? false;
  const source = tex ?? squash(el.querySelector(".katex-html")?.textContent ?? "").trim();
  return display ? `$$${source}$$` : `$${source}$`;
}

/** Walk `node` into `lines`. */
function walk(node: Node, lines: Lines): void {
  if (node.nodeType === 3) {
    lines.text(node.textContent ?? "");
    return;
  }
  if (node.nodeType !== 1) return;
  const el = node as Element;
  const tag = el.tagName.toUpperCase();
  if (
    SKIPPED.has(tag) ||
    el.hasAttribute("hidden") ||
    el.getAttribute("aria-hidden") === "true" ||
    SKIPPED_CLASSES.some((name) => el.classList.contains(name))
  ) {
    return;
  }
  if (el.classList.contains("katex")) {
    lines.text(mathText(el));
    return;
  }
  const heading = /^H([1-6])$/.exec(tag);
  if (heading) {
    lines.space();
    lines.line(`${"#".repeat(Number(heading[1]))} ${squash(el.textContent ?? "").trim()}`);
    lines.space();
    return;
  }
  switch (tag) {
    case "BR":
      lines.flush();
      return;
    case "PRE":
      lines.space();
      for (const code of (el.textContent ?? "").replace(/\n$/, "").split("\n"))
        lines.line(`  ${code}`);
      lines.space();
      return;
    case "IMG": {
      const alt = el.getAttribute("alt");
      if (alt) lines.text(`[image: ${alt}]`);
      return;
    }
    case "LI": {
      lines.flush();
      const list = el.parentElement;
      const ordered = list?.tagName.toUpperCase() === "OL";
      const index = list ? [...list.children].indexOf(el) : 0;
      const start = Number(list?.getAttribute("start") ?? 1);
      lines.text(ordered ? `${start + index}. ` : "- ");
      el.childNodes.forEach((childNode) => walk(childNode, lines));
      lines.flush();
      return;
    }
    case "TR": {
      lines.flush();
      const cells = [...el.children].map((cell) => squash(cell.textContent ?? "").trim());
      lines.line(cells.join(" | "));
      return;
    }
    case "HR":
      lines.space();
      lines.line("-");
      lines.space();
      return;
    case "BLOCKQUOTE": {
      lines.space();
      const outer = lines.quote;
      lines.quote = `${outer}> `;
      el.childNodes.forEach((childNode) => walk(childNode, lines));
      lines.flush();
      lines.quote = outer;
      lines.space();
      return;
    }
  }
  const block = BLOCKS.has(tag);
  if (block) lines.flush();
  el.childNodes.forEach((childNode) => walk(childNode, lines));
  if (SPACED.has(tag)) lines.space();
  else if (block) lines.flush();
}

/**
 * A page's content as lines of text.
 *
 * @param root - The page's `<main>` (or any element).
 * @returns Lines without trailing blanks; at most one blank line in a row.
 */
export function pageText(root: Element): string[] {
  const lines = new Lines();
  walk(root, lines);
  lines.flush();
  return lines.out;
}

/**
 * The headings of a page that have ids, in document order: every `##` and `###`
 * heading of a sheet or post (rehype-slug gives them ids).
 *
 * @param root - The page's `<main>` (or any element).
 */
export function pageHeadings(root: ParentNode): Heading[] {
  return [...root.querySelectorAll("h2[id], h3[id]")].map((el) => ({
    id: el.id,
    text: squash(el.textContent ?? "").trim(),
    level: Number(el.tagName.slice(1)),
  }));
}

/**
 * The `<main>` of a page fetched as HTML.
 *
 * @param html - The page's HTML.
 * @returns Its `<main>`, or `null` when it has none.
 */
export function parseMain(html: string): Element | null {
  return new DOMParser().parseFromString(html, "text/html").querySelector("main");
}
