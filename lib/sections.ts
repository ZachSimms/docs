/**
 * @file The site's top-level sections, in the order the left-hand navigation lists them.
 *
 * The docs (every topic, directory and sheet) count as one section, `docs`, so the
 * navigation can mark it and unfold the topic tree beneath it.
 */

/** Key of a top-level section; pages pass one to `Page` to mark it in the navigation. */
export type SectionKey = "home" | "projects" | "blog" | "resume" | "docs" | "playground" | "info";

/** One entry of the section navigation. */
export interface Section {
  readonly key: SectionKey;
  /** Link text. */
  readonly label: string;
  /** Destination, with the site's trailing slash. */
  readonly href: string;
}

/**
 * All sections in display order. Like the topic lists, the numbers count down, so
 * the first entry gets the highest number (see {@link sectionNumber}).
 */
export const SECTIONS: readonly Section[] = [
  { key: "home", label: "Home", href: "/" },
  { key: "projects", label: "Projects", href: "/projects/" },
  { key: "blog", label: "Blog", href: "/blog/" },
  { key: "resume", label: "Resume", href: "/resume/" },
  { key: "docs", label: "Docs", href: "/docs/" },
  { key: "playground", label: "Playground", href: "/playground/" },
  { key: "info", label: "Info", href: "/info/" },
];

/**
 * The number shown beside a section in the navigation: `07.` for the first of seven,
 * `01.` for the last.
 *
 * @param key - The section.
 * @returns The 1-based number, or `undefined` for an unknown key.
 */
export function sectionNumber(key: SectionKey): number | undefined {
  const index = SECTIONS.findIndex((section) => section.key === key);
  return index === -1 ? undefined : SECTIONS.length - index;
}
