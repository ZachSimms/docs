/**
 * @file Shared page shell: the split layout.
 *
 * Every route but the playground renders through this: the site navigation on the
 * left (`SiteNav`), and on the right an optional breadcrumb trail, the heading, the
 * body and the footer. On narrow viewports the navigation folds into a line of links
 * above the page (see the `.split` rules in globals.css).
 */

import type { ReactNode } from "react";
import type { SectionKey } from "@/lib/sections";
import { DottedLink } from "./DottedLink";
import { ParentLink } from "./ParentLink";
import { SearchLink } from "./SearchLink";
import { SiteNav, type DocsLocation } from "./SiteNav";

/** The primary footer link: usually `../`. */
export interface FooterLink {
  readonly href: string;
  readonly label: string;
  /** Screen-reader description for terse labels such as `../`. */
  readonly ariaLabel?: string;
}

/** One step of the breadcrumb trail; the last one (the page itself) has no link. */
export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

/** Props for {@link Page}. */
interface PageProps {
  /** Rendered as the `<h1>`. */
  title: string;
  /** Primary footer link; the Search control is always appended after it. */
  footer: FooterLink;
  /** An extra link between the primary link and Search. */
  secondaryFooter?: FooterLink;
  /**
   * Also pin the footer link to the top-left of the content column, fixed
   * while scrolling, so long pages can be left without scrolling to the end.
   * The pinned copy also answers `Esc` (see `ParentLink`). Off on the home
   * page, which has nothing to go back to.
   */
  pinFooterLink?: boolean;
  /** The section to mark in the navigation. */
  section?: SectionKey;
  /** For docs pages: where to unfold the topic tree (see `SiteNav`). */
  docs?: DocsLocation;
  /** Breadcrumb trail shown above the heading. */
  crumbs?: readonly Crumb[];
  /** Shown on the heading's line, right-aligned (a date, a download link). */
  titleAside?: ReactNode;
  /** Page body, placed after the heading. */
  children: ReactNode;
}

/** `docs / python / fastapi`: links for every step but the last. */
function Crumbs({ crumbs }: { crumbs: readonly Crumb[] }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={`${i}-${crumb.label}`}>
          {i > 0 && <span className="crumb-sep"> / </span>}
          {crumb.href ? (
            <DottedLink href={crumb.href} prefetch={false}>
              {crumb.label}
            </DottedLink>
          ) : (
            <span aria-current="page">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/**
 * Render the navigation beside `<main>{crumbs}<h1/>…</main><footer>…</footer>`.
 *
 * The footer controls are separated by two spaces to stay on the monospace grid.
 * With `pinFooterLink` the primary link is repeated in a fixed rail at the top-left of
 * the content column (the theme toggle occupies the top-right from the root layout).
 */
export function Page({
  title,
  footer,
  secondaryFooter,
  pinFooterLink = false,
  section,
  docs,
  crumbs,
  titleAside,
  children,
}: PageProps) {
  return (
    <>
      {pinFooterLink && (
        <div className="back-rail">
          <ParentLink href={footer.href} label={footer.label} ariaLabel={footer.ariaLabel} />
        </div>
      )}
      <div className="split">
        <SiteNav section={section} docs={docs} />
        <div className="split-main">
          <main>
            {crumbs && crumbs.length > 0 && <Crumbs crumbs={crumbs} />}
            <div className="page-head">
              <h1>{title}</h1>
              {titleAside}
            </div>
            {children}
          </main>
          <footer>
            <p>
              <DottedLink href={footer.href} ariaLabel={footer.ariaLabel}>
                {footer.label}
              </DottedLink>
              {"  "}
              {secondaryFooter && (
                <>
                  <DottedLink href={secondaryFooter.href} ariaLabel={secondaryFooter.ariaLabel}>
                    {secondaryFooter.label}
                  </DottedLink>
                  {"  "}
                </>
              )}
              <SearchLink />
            </p>
          </footer>
        </div>
      </div>
    </>
  );
}
