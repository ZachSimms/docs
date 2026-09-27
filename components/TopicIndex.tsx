/**
 * @file A topic page's contents with every directory unfolded: each directory is a
 * section headed by its own link, listing its sheets. The topic's order is kept:
 * consecutive directories share a block of columns, and consecutive loose sheets a
 * list (headed "Sheets" when the topic also has directories).
 *
 * Client component: directory headings and sheets together are one menu (see
 * `useMenu`), in reading order, so the keyboard reaches every sheet of the topic
 * without opening a directory first.
 */

"use client";

import { Fragment } from "react";
import { padNumber } from "@/lib/format";
import { DottedLink } from "./DottedLink";
import type { NumberedItem } from "./NumberedList";
import { useMenu, type RowProps } from "./useMenu";

/** A directory: its own row (heading) and its sheets. */
export interface TopicFolder {
  readonly heading: NumberedItem;
  readonly sheets: readonly NumberedItem[];
}

/** One entry of a topic, in the topic's display order. */
export type TopicIndexEntry =
  | { readonly kind: "folder"; readonly folder: TopicFolder }
  | { readonly kind: "sheet"; readonly sheet: NumberedItem };

/** Consecutive entries of the same kind, rendered as one block. */
type Run =
  | { readonly kind: "folders"; readonly folders: TopicFolder[] }
  | { readonly kind: "sheets"; readonly sheets: NumberedItem[] };

/** Group consecutive directories and consecutive loose sheets, keeping their order. */
function runsOf(entries: readonly TopicIndexEntry[]): Run[] {
  const runs: Run[] = [];
  for (const entry of entries) {
    const last = runs.at(-1);
    if (entry.kind === "folder") {
      if (last?.kind === "folders") last.folders.push(entry.folder);
      else runs.push({ kind: "folders", folders: [entry.folder] });
    } else if (last?.kind === "sheets") last.sheets.push(entry.sheet);
    else runs.push({ kind: "sheets", sheets: [entry.sheet] });
  }
  return runs;
}

/** Props for {@link Row}. */
interface RowArgs {
  readonly item: NumberedItem;
  readonly on: boolean;
  readonly props: RowProps;
  /** End with a line break (every row but a heading, which is a block of its own). */
  readonly br: boolean;
}

/** One numbered row: `NN.`, a no-break space and the link, then a line break unless a heading. */
function Row({ item, on, props, br }: RowArgs) {
  return (
    <>
      <span data-active={on ? "" : undefined}>{padNumber(item.number)}.</span>
      {"\u00a0"}
      <DottedLink href={item.href} {...props}>
        {item.label}
      </DottedLink>
      {br && <br />}
    </>
  );
}

/** Render the topic's entries: directories as sections, loose sheets as lists, in order. */
export function TopicIndex({ entries }: { entries: readonly TopicIndexEntry[] }) {
  const rows = entries.flatMap((entry) =>
    entry.kind === "folder" ? [entry.folder.heading, ...entry.folder.sheets] : [entry.sheet],
  );
  const { navRef, active, rowProps } = useMenu(rows.map((row) => row.href));
  /** Each row's position in the menu, by href (hrefs are unique within a topic). */
  const position = new Map(rows.map((row, i) => [row.href, i]));
  /** Render one row with its menu position. */
  const row = (item: NumberedItem, br = true) => {
    const i = position.get(item.href) ?? 0;
    return <Row key={item.href} item={item} on={i === active} props={rowProps(i)} br={br} />;
  };
  const hasFolders = entries.some((entry) => entry.kind === "folder");

  return (
    <nav ref={navRef} data-menu="" className="topic-index" aria-label="Sheets">
      {runsOf(entries).map((run) =>
        run.kind === "folders" ? (
          <div key={run.folders[0]?.heading.href} className="topic-folders">
            {run.folders.map((folder) => (
              <section key={folder.heading.href} className="topic-folder">
                <h2>
                  {row(folder.heading, false)}
                  <span className="dim topic-count">{folder.sheets.length}</span>
                </h2>
                {folder.sheets.map((sheet) => (
                  <Fragment key={sheet.href}>{row(sheet)}</Fragment>
                ))}
              </section>
            ))}
          </div>
        ) : (
          <section key={run.sheets[0]?.href} className="topic-folder topic-loose">
            {hasFolders && (
              <h2>
                Sheets<span className="dim topic-count">{run.sheets.length}</span>
              </h2>
            )}
            {run.sheets.map((sheet) => (
              <Fragment key={sheet.href}>{row(sheet)}</Fragment>
            ))}
          </section>
        ),
      )}
    </nav>
  );
}
