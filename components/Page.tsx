/**
 * @file Shared page shell: heading, dash separator, body and footer.
 *
 * Every route renders through this so the structure matches the original
 * site's `<main>…</main><footer>…</footer>` exactly.
 */

import type { ReactNode } from "react";
import { DottedLink } from "./DottedLink";
import { ParentLink } from "./ParentLink";
import { SearchLink } from "./SearchLink";

/** The primary footer link: `Info` on the home page, `../` everywhere else. */
export interface FooterLink {
  readonly href: string;
  readonly label: string;
  /** Screen-reader description for terse labels such as `../`. */
  readonly ariaLabel?: string;
}

/** Props for {@link Page}. */
interface PageProps {
  /** Rendered as the `<h1>`. */
  title: string;
  /** Primary footer link; the Search control is always appended after it. */
  footer: FooterLink;
  /** An extra link between the primary link and Search (the home page's `Playground`). */
  secondaryFooter?: FooterLink;
  /**
   * Also pin the footer link to the top-left of the content column, fixed
   * while scrolling, so long pages can be left without scrolling to the end.
   * The pinned copy also answers `Esc` (see `ParentLink`). Off on the home
   * page, which has nothing to go back to.
   */
  pinFooterLink?: boolean;
  /** Page body, placed after the `-` separator. */
  children: ReactNode;
}

/**
 * Render `<main><h1/><p>-</p>…</main><footer><p><a><i>…</i></a>  Search</p></footer>`
 * (with an optional second link before Search).
 *
 * The two footer controls are separated by two spaces to stay on the
 * monospace grid. With `pinFooterLink` the primary link is repeated in a fixed
 * rail at the top-left of the column (the theme toggle occupies the top-right
 * from the root layout).
 */
export function Page({
  title,
  footer,
  secondaryFooter,
  pinFooterLink = false,
  children,
}: PageProps) {
  return (
    <>
      {pinFooterLink && (
        <div className="back-rail">
          <ParentLink href={footer.href} label={footer.label} ariaLabel={footer.ariaLabel} />
        </div>
      )}
      <main>
        <h1>{title}</h1>
        <p>-</p>
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
    </>
  );
}
