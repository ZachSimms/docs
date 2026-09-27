/**
 * @file The numbered link list used on directory pages, `/sheets/` and wherever a
 * page lists sheets one per line.
 *
 * Client component: besides rendering the list it makes it a keyboard/mouse menu
 * (see `useMenu`). The highlighted row gets `data-active` on its number and link;
 * the CSS draws a `>` marker in the gutter and a solid underline.
 */

"use client";

import { Fragment } from "react";
import { BreakablePath } from "@/components/BreakablePath";
import { padNumber } from "@/lib/format";
import { DottedLink } from "./DottedLink";
import { useMenu } from "./useMenu";

/** One row of a {@link NumberedList}. */
export interface NumberedItem {
  /** Non-negative integer shown zero-padded, e.g. `8` renders as `08.`. */
  readonly number: number;
  /** Link destination; also used as the React key, so it must be unique per list. */
  readonly href: string;
  /** Link text. */
  readonly label: string;
}

/**
 * Render `<nav><span>NN.</span>&nbsp;<a><i>label</i></a><br>…</nav>`, the
 * markup of the original site except for the no-break space and the `<wbr>`
 * break points after slashes, which keep a long path beside its number on phones.
 * The nav carries `data-menu` so the first list on a page can be found.
 *
 * @param props.items - Rows in display order; an empty list renders an empty `<nav>`.
 */
export function NumberedList({ items }: { items: readonly NumberedItem[] }) {
  const { navRef, active, rowProps } = useMenu(items.map((item) => item.href));

  return (
    <nav ref={navRef} data-menu="">
      {items.map((item, i) => (
        <Fragment key={item.href}>
          {/* A no-break space keeps the label on the number's line; it wraps at its slashes. */}
          <span data-active={i === active ? "" : undefined}>{padNumber(item.number)}.</span>
          {"\u00a0"}
          <DottedLink href={item.href} {...rowProps(i)}>
            <BreakablePath label={item.label} />
          </DottedLink>
          <br />
        </Fragment>
      ))}
    </nav>
  );
}
