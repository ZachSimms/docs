/**
 * @file The body of every cheatsheet page, shared by the loose-sheet route
 * (`/[topic]/[slug]/`) and the directory-sheet route (`/[topic]/[slug]/[sheet]/`),
 * and of blog posts (`/blog/[slug]/`).
 */

import type { ReactNode } from "react";
import type { SectionKey } from "@/lib/sections";
import type { TocEntry } from "@/lib/toc";
import { Page, type Crumb, type FooterLink } from "./Page";
import type { DocsLocation } from "./SiteNav";
import { Toc } from "./Toc";
// Math only appears on sheets: other pages (home, topics, the playground) skip KaTeX's CSS.
import "katex/dist/katex.min.css";
import "./SheetView.css";

/** Props for {@link SheetView}. */
interface SheetViewProps {
  /** Frontmatter title, rendered as the `<h1>`. */
  readonly title: string;
  /** Frontmatter date (`YYYY-MM-DD`), printed on the heading's line. */
  readonly date: string;
  /** The `../` link to the parent page (topic or directory); also pinned at the top. */
  readonly back: FooterLink;
  /** Headings for the right-margin contents; fewer than two renders none. */
  readonly toc: readonly TocEntry[];
  /** Breadcrumb trail above the heading. */
  readonly crumbs?: readonly Crumb[];
  /** Section marked in the navigation; defaults to the docs. */
  readonly section?: SectionKey;
  /** Where to unfold the docs tree in the navigation (sheets only). */
  readonly docs?: DocsLocation;
  /** The compiled MDX sheet. */
  readonly children: ReactNode;
}

/**
 * Render a cheatsheet: breadcrumbs, title and date, MDX body, pinned back link and the
 * table of contents in the right margin.
 */
export function SheetView({
  title,
  date,
  back,
  toc,
  crumbs,
  section = "docs",
  docs,
  children,
}: SheetViewProps) {
  return (
    <>
      <Page
        title={title}
        footer={back}
        pinFooterLink
        section={section}
        docs={docs}
        crumbs={crumbs}
        titleAside={
          <time className="dim" dateTime={date}>
            {date}
          </time>
        }
      >
        {children}
      </Page>
      <Toc entries={toc} />
    </>
  );
}
