/**
 * @file Light highlighting for the Markdown pane: what each line of an MDX source is,
 * so the pane can dim the frontmatter and fences and bold the headings.
 *
 * Line-based on purpose (no Markdown parser on the client): a heading is a line starting
 * with `#`s outside a code fence, a fence toggles on ```` ``` ```` or `~~~`, and the
 * frontmatter is the `---` block at the top.
 */

/** What a line of MDX is. */
export type LineKind = "meta" | "heading" | "fence" | "code" | "jsx" | "text";

/** A line of the source and its kind. */
export interface SourceLine {
  readonly text: string;
  readonly kind: LineKind;
}

/** Opens or closes a fenced code block, capturing the marker. */
const FENCE = /^\s*(`{3,}|~{3,})/;
/** An ATX heading. */
const HEADING = /^#{1,6}\s/;
/** MDX's own statements (`import`, `export`) at the top level. */
const ESM = /^(?:import|export)\s/;
/** A line that opens or closes a JSX component (`<Note>`, `</Tabs>`). */
const JSX = /^\s*<\/?[A-Z]/;

/**
 * Classify every line of an MDX source.
 *
 * @param source - The file's text.
 * @returns One entry per line (a trailing newline adds no empty last line).
 */
export function classifyLines(source: string): SourceLine[] {
  const lines = source.replace(/\r\n?/g, "\n").replace(/\n$/, "").split("\n");
  const out: SourceLine[] = [];
  let fence: string | null = null;
  let frontmatter = lines[0] === "---";
  lines.forEach((text, i) => {
    if (frontmatter) {
      out.push({ text, kind: "meta" });
      if (i > 0 && text === "---") frontmatter = false;
      return;
    }
    const marker = FENCE.exec(text)?.[1];
    if (fence !== null) {
      const closes =
        marker !== undefined && marker[0] === fence[0] && marker.length >= fence.length;
      if (closes) fence = null;
      out.push({ text, kind: closes ? "fence" : "code" });
      return;
    }
    if (marker !== undefined) {
      fence = marker;
      out.push({ text, kind: "fence" });
    } else if (HEADING.test(text)) out.push({ text, kind: "heading" });
    else if (ESM.test(text)) out.push({ text, kind: "meta" });
    else if (JSX.test(text)) out.push({ text, kind: "jsx" });
    else out.push({ text, kind: "text" });
  });
  return out;
}
