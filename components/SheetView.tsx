/**
 * @file The body of every cheatsheet page, shared by the loose-sheet route
 * (`/[topic]/[slug]/`) and the directory-sheet route (`/[topic]/[slug]/[sheet]/`).
 */

import type { ReactNode } from "react";
import type { TocEntry } from "@/lib/toc";
import { Page, type FooterLink } from "./Page";
import { Toc } from "./Toc";

/** Props for {@link SheetView}. */
interface SheetViewProps {
  /** Frontmatter title, rendered as the `<h1>`. */
  readonly title: string;
  /** Frontmatter date (`YYYY-MM-DD`), printed under the body. */
  readonly date: string;
  /** The `../` link to the parent page (topic or directory); also pinned at the top. */
  readonly back: FooterLink;
  /** Headings for the right-margin contents; fewer than two renders none. */
  readonly toc: readonly TocEntry[];
  /** The compiled MDX sheet. */
  readonly children: ReactNode;
}

/**
 * Render a cheatsheet: title, MDX body, date, pinned back link and the table of
 * contents in the right margin.
 */
export function SheetView({ title, date, back, toc, children }: SheetViewProps) {
  return (
    <>
      <Page title={title} footer={back} pinFooterLink>
        {children}
        <time dateTime={date}>{date}</time>
      </Page>
      <Toc entries={toc} />
    </>
  );
}
