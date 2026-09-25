/**
 * @file `<FileTree>`: a directory layout drawn like the `tree` command.
 *
 * Server component. Authors write a `tree` code fence (two spaces per level,
 * trailing `/` for directories, `# text` for comments), which
 * `lib/remark-file-tree.ts` turns into this element with the outline as a
 * plain string; `lib/file-tree.ts` parses it and draws the guides. Passing a
 * template literal (`tree={…}`) by hand in MDX is unsafe: MDX strips up to two
 * leading spaces per line of an attribute expression.
 * The markup mirrors a rehype-pretty-code figure so it shares the code-block
 * box, caption and line styling.
 *
 * @example
 * ```tree title="monorepo"
 * apps/
 *   web/  # Next.js
 * packages/
 * ```
 */

import { drawComment, parseTree, renderTreeLines } from "@/lib/file-tree";

/** Props for {@link FileTree}. */
interface FileTreeProps {
  /** The indented outline; see the file header. */
  tree: string;
  /** Optional caption shown above the box, like a code block's `title`. */
  title?: string;
}

/**
 * Render `figure.file-tree > figcaption? + pre > code > span[data-line]*`.
 * Directory names are `.ft-dir` (bold), guide characters `.ft-guide` and
 * comments `.ft-comment` (both dimmed). The figure is labelled "File tree"
 * (plus the title) and the guide glyphs are hidden from screen readers.
 *
 * @throws {Error} At build time, if the outline is badly indented (see `parseTree`).
 */
export function FileTree({ tree, title }: FileTreeProps) {
  const lines = renderTreeLines(parseTree(tree));
  return (
    <figure
      className="file-tree"
      data-rehype-pretty-code-figure=""
      aria-label={title ? `File tree: ${title}` : "File tree"}
    >
      {title && <figcaption data-rehype-pretty-code-title="">{title}</figcaption>}
      <pre>
        <code>
          {lines.map((line, i) => (
            <span key={i} data-line="">
              {line.prefix && (
                <span className="ft-guide" aria-hidden="true">
                  {line.prefix}
                </span>
              )}
              <span className={line.isDir ? "ft-dir" : undefined}>{line.name}</span>
              {line.comment && <span className="ft-comment">{drawComment(line)}</span>}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
