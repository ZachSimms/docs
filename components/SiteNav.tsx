/**
 * @file The left-hand navigation of the split layout: the site's sections, and inside
 * the docs, the topic tree unfolded down to the page being read.
 *
 * Server component (reads `content/` for the tree). Its links are plain links, not a
 * keyboard menu: `j`/`k` stay with the page's own list. On narrow viewports the CSS
 * turns the sections into one wrapped line above the page and hides the tree.
 */

import type { ReactNode } from "react";
import { groupHref, listGroupSheets, listTopicEntries, sheetHref } from "@/lib/content";
import { padNumber } from "@/lib/format";
import { SECTIONS, sectionNumber, type SectionKey } from "@/lib/sections";
import { PROFILE } from "@/lib/profile";
import { TOPICS } from "@/lib/topics";
import { DottedLink } from "./DottedLink";
import { NavScroller } from "./NavScroller";
import { SearchLink } from "./SearchLink";
import { TerminalLink } from "./TerminalLink";

/** Where in the docs a page sits; each level unfolds the tree one step further. */
export interface DocsLocation {
  readonly topic?: string;
  /** A directory of `topic`. */
  readonly group?: string;
  /** A sheet: loose in `topic`, or inside `group`. */
  readonly sheet?: string;
}

/** Props for {@link SiteNav}. */
interface SiteNavProps {
  /** The section the page belongs to, marked in the list. */
  readonly section?: SectionKey;
  /**
   * For pages below `/docs/`: the topic, directory and sheet to unfold. Any value,
   * even `{}` (as on `/sheets/`), marks Docs as a parent rather than the page itself.
   */
  readonly docs?: DocsLocation;
}

/** How a tree row relates to the page: the page itself, one of its parents, or neither. */
type Mark = "page" | "path" | undefined;

/** One line of the navigation: an optional `>` marker, the link, and anything nested. */
function NavRow({
  href,
  label,
  mark,
  number,
  children,
}: {
  href: string;
  label: string;
  mark: Mark;
  number?: number;
  children?: ReactNode;
}) {
  return (
    <li data-mark={mark}>
      {number !== undefined && <span className="nav-num">{padNumber(number)}.</span>}
      <DottedLink href={href} prefetch={false} aria-current={mark === "page" ? "page" : undefined}>
        {label}
      </DottedLink>
      {children}
    </li>
  );
}

/** The topics, with the current topic (and directory) unfolded. */
function DocsTree({ topic, group, sheet }: DocsLocation) {
  return (
    <ul className="nav-tree">
      {TOPICS.map(({ slug, name }) => {
        const here = slug === topic;
        const mark: Mark = here ? (group || sheet ? "path" : "page") : undefined;
        return (
          <NavRow key={slug} href={`/${slug}/`} label={name} mark={mark}>
            {here && (
              <ul>
                {listTopicEntries(slug).map((entry) => {
                  if (entry.kind === "sheet") {
                    const current = group === undefined && entry.slug === sheet;
                    return (
                      <NavRow
                        key={entry.slug}
                        href={sheetHref(entry)}
                        label={entry.title}
                        mark={current ? "page" : undefined}
                      />
                    );
                  }
                  const open = entry.slug === group;
                  return (
                    <NavRow
                      key={entry.slug}
                      href={groupHref(entry)}
                      label={`${entry.title}/`}
                      mark={open ? (sheet ? "path" : "page") : undefined}
                    >
                      {open && (
                        <ul>
                          {listGroupSheets(slug, entry.slug).map((child) => (
                            <NavRow
                              key={child.slug}
                              href={sheetHref(child)}
                              label={child.title}
                              mark={child.slug === sheet ? "page" : undefined}
                            />
                          ))}
                        </ul>
                      )}
                    </NavRow>
                  );
                })}
              </ul>
            )}
          </NavRow>
        );
      })}
    </ul>
  );
}

/**
 * Render `<aside>`: the site name, the numbered sections (the current one marked, the
 * docs tree under Docs when inside a topic), then GitHub, Search and Terminal.
 */
export function SiteNav({ section, docs }: SiteNavProps) {
  const inTopic = docs?.topic !== undefined;
  return (
    <aside className="site-nav" aria-label="Site">
      <p className="site-name">
        <DottedLink href="/" prefetch={false}>
          {PROFILE.name.toLowerCase()}
        </DottedLink>
      </p>
      <p className="nav-rule" aria-hidden="true">
        -
      </p>
      <nav aria-label="Sections">
        <ul className="nav-sections">
          {SECTIONS.map(({ key, label, href }) => {
            const below = key === "docs" && docs !== undefined;
            const mark: Mark = key === section ? (below ? "path" : "page") : undefined;
            return (
              <NavRow key={key} href={href} label={label} mark={mark} number={sectionNumber(key)}>
                {key === "docs" && inTopic && <DocsTree {...docs} />}
              </NavRow>
            );
          })}
        </ul>
      </nav>
      <p className="nav-rule" aria-hidden="true">
        -
      </p>
      <p className="nav-links">
        <DottedLink href={PROFILE.github}>GitHub</DottedLink>
        {PROFILE.email && (
          <>
            <br />
            <DottedLink href={`mailto:${PROFILE.email}`}>Email</DottedLink>
          </>
        )}
        <br />
        <SearchLink />
        <span className="dim"> ⌘K</span>
        <br />
        <TerminalLink />
        <span className="dim"> `</span>
      </p>
      <NavScroller />
    </aside>
  );
}
