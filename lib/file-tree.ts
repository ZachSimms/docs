/**
 * @file Directory-tree diagrams for MDX (`<FileTree>`).
 *
 * Authors write an indented outline; this module parses it and draws the
 * `tree`-style guide lines, so sheets never hand-draw `├──` characters:
 *
 * ```text
 * repo/                 # a trailing slash marks a directory
 *   src/
 *     index.ts          # " # text" after a name is a comment
 *   package.json
 * ```
 */

/** One file or directory in the outline. */
export interface TreeNode {
  /** Name as written, including a directory's trailing `/`. */
  readonly name: string;
  /** Whether the name ends in `/`. */
  readonly isDir: boolean;
  /** Annotation written after `  # `, if any. */
  readonly comment?: string;
  /** Entries nested one level deeper. */
  readonly children: readonly TreeNode[];
}

/** One drawn line of the diagram. */
export interface TreeLine {
  /** Guide characters before the name, e.g. `"│   ├── "`; empty at the top level. */
  readonly prefix: string;
  readonly name: string;
  readonly isDir: boolean;
  readonly comment?: string;
  /** Spaces to add after the name so every comment starts in the same column. */
  readonly pad: number;
}

/** Spaces per nesting level in the outline. */
const INDENT = 2;
/** A comment: whitespace, `#`, then the text (a `#` inside a name is not a comment). */
const COMMENT = /\s+#(?:\s+(.*))?$/;

/** A mutable node used while parsing; frozen into {@link TreeNode} on return. */
interface Draft {
  name: string;
  isDir: boolean;
  comment?: string;
  children: Draft[];
}

/** Split `name  # comment` into its parts. */
function splitLine(content: string): Omit<Draft, "children"> {
  const match = COMMENT.exec(content);
  const name = (match ? content.slice(0, match.index) : content).trim();
  const comment = match?.[1]?.trim();
  return { name, isDir: name.endsWith("/"), ...(comment ? { comment } : {}) };
}

/**
 * Parse an indented outline into a tree.
 *
 * The outline may be indented as a whole (it is dedented by its smallest
 * indentation); blank lines are ignored.
 *
 * @param source - The outline, two spaces per level.
 * @returns The top-level nodes in order.
 * @throws {Error} If a line's indentation is not a multiple of two spaces, or
 *   a line is nested more than one level below the line before it.
 */
export function parseTree(source: string): TreeNode[] {
  const lines = source.split("\n").filter((line) => line.trim() !== "");
  const indentOf = (line: string) => line.length - line.trimStart().length;
  const base = Math.min(...lines.map(indentOf));
  const roots: Draft[] = [];
  const stack: Draft[] = []; // stack[d] = the latest node at depth d

  lines.forEach((line, i) => {
    const indent = indentOf(line) - base;
    if (indent % INDENT !== 0) {
      throw new Error(`FileTree line ${i + 1} ("${line.trim()}"): indent by ${INDENT} spaces`);
    }
    const depth = indent / INDENT;
    if (depth > stack.length) {
      throw new Error(`FileTree line ${i + 1} ("${line.trim()}"): skips a level`);
    }
    const node: Draft = { ...splitLine(line.trim()), children: [] };
    (depth === 0 ? roots : stack[depth - 1]!.children).push(node);
    stack.length = depth;
    stack.push(node);
  });
  return roots;
}

/**
 * The comment part of a drawn line: padding, two spaces, `# `, the text.
 *
 * @param line - A line from {@link renderTreeLines}.
 * @returns The suffix to print after the name, or `""` without a comment.
 */
export function drawComment(line: TreeLine): string {
  return line.comment ? `${" ".repeat(line.pad)}  # ${line.comment}` : "";
}

/**
 * A drawn line as plain text: guides, name and aligned comment.
 *
 * @param line - A line from {@link renderTreeLines}.
 * @returns What the line shows, e.g. `"├── src/  # code"`.
 */
export function drawTreeLine(line: TreeLine): string {
  return `${line.prefix}${line.name}${drawComment(line)}`;
}

/**
 * Draw a parsed tree as lines, like the Unix `tree` command: top-level
 * entries have no guide, nested ones get `├── ` / `└── ` and a `│   `
 * continuation for every ancestor that has later siblings.
 *
 * @param nodes - Output of {@link parseTree}.
 * @returns One line per node, depth-first, with comment padding computed.
 */
export function renderTreeLines(nodes: readonly TreeNode[]): TreeLine[] {
  const drawn: Omit<TreeLine, "pad">[] = [];
  const walk = (list: readonly TreeNode[], guides: string, depth: number) => {
    list.forEach((node, i) => {
      const last = i === list.length - 1;
      const prefix = depth === 0 ? "" : `${guides}${last ? "└── " : "├── "}`;
      drawn.push({
        prefix,
        name: node.name,
        isDir: node.isDir,
        ...(node.comment ? { comment: node.comment } : {}),
      });
      const next = depth === 0 ? "" : `${guides}${last ? "    " : "│   "}`;
      walk(node.children, next, depth + 1);
    });
  };
  walk(nodes, "", 0);

  const width = (l: Omit<TreeLine, "pad">) => l.prefix.length + l.name.length;
  const column = Math.max(0, ...drawn.filter((l) => l.comment).map(width));
  return drawn.map((l) => ({ ...l, pad: l.comment ? column - width(l) : 0 }));
}
