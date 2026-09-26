/**
 * @file `<Note>`: a labeled aside for cheatsheets.
 *
 * Registered globally in `mdx-components.tsx`, so MDX files can write
 * `<Note kind="tip">…</Note>` without importing anything. `<Callout>` is a
 * thin wrapper that maps Fumadocs-style `type`s onto this component.
 */

import type { ReactNode } from "react";

/** Props for {@link Note}. */
export interface NoteProps {
  /** Short label printed before the text, e.g. "note", "warning", "tip". */
  kind?: string;
  /** Optional bold heading line shown above the label and body. */
  title?: string;
  /** The note body; inline Markdown or whole paragraphs both work. */
  children: ReactNode;
}

/**
 * An aside in the house style: a dotted left rule and a lowercase bold label.
 *
 * Renders `<aside class="note" role="note" data-kind="…">`. With a `title` the
 * first line is `kind: title` in bold and the body follows; without one the
 * label sits on the same line as inline content. The body is a `<div>` rather
 * than a `<p>` so MDX block content (paragraphs, lists, code) nests validly.
 */
export function Note({ kind = "note", title, children }: NoteProps) {
  return (
    <aside className="note" role="note" data-kind={kind}>
      {title ? (
        <>
          <p className="note-title">
            <b>
              {kind}: {title}
            </b>
          </p>
          <div className="note-body">{children}</div>
        </>
      ) : (
        <div className="note-body">
          <b>{kind}:</b> {children}
        </div>
      )}
    </aside>
  );
}
