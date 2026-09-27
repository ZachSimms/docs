/**
 * @file Everything personal the Home, Projects and Resume pages show, in one place.
 *
 * Strings in `[square brackets]` are placeholders still to be written: the pages
 * render them as they are, so they are easy to spot on the site. Replace them here;
 * no page needs to change. A resume section with no entries is not rendered.
 */

import { listAllSheets } from "./content";
import { DOCS_TITLE } from "./site";
import { TOPICS } from "./topics";

/** Who the site is about. */
export const PROFILE = {
  /** Home page heading and the start of every `<title>`. */
  name: "Zach",
  /** Full name, as the resume prints it. */
  fullName: "Zach [Surname]",
  /** The role the resume is aimed at. */
  role: "[target role]",
  location: "[City]",
  /** Home page introduction: two or three sentences. */
  bio: "[Two or three lines of bio: what you do, what you are learning, what you want to be asked about.]",
  github: "https://github.com/ZachSimms",
  /** Optional `mailto:` target; leave undefined to show no email link. */
  email: undefined as string | undefined,
} as const;

/** One project card. */
export interface Project {
  readonly name: string;
  /** Where the name links: the project itself (an internal page or a live URL). */
  readonly href: string;
  readonly description: string;
  readonly stack: readonly string[];
  readonly year: string;
  /** Source repository, if public. */
  readonly source?: string;
  /** Shown on the home page as well as on `/projects/`. */
  readonly featured?: boolean;
}

/** Counts shown wherever the docs are described. */
export interface DocsStats {
  readonly sheets: number;
  readonly topics: number;
}

/** Live sheet and topic counts, read from `content/` at build time. */
export function docsStats(): DocsStats {
  return { sheets: listAllSheets().length, topics: TOPICS.length };
}

/**
 * Every project, newest first. The docs description is built from live counts,
 * so it never goes stale as sheets are added.
 */
export function listProjects(): Project[] {
  const { sheets, topics } = docsStats();
  return [
    {
      name: DOCS_TITLE,
      href: "/docs/",
      description: `${sheets} cheatsheets across ${topics} topics. Prerendered, searchable with ⌘K, navigable from the keyboard.`,
      stack: ["Next.js 16", "React 19", "MDX", "KaTeX", "Shiki", "Bun"],
      year: "2026",
      source: "https://github.com/ZachSimms/docs",
      featured: true,
    },
    {
      name: "Playground",
      href: "/playground/",
      description:
        "Write and run C++, Rust, Python, JavaScript, TypeScript, HTML/CSS and GDScript projects in the browser, with the reference sheets beside the code.",
      stack: ["CodeMirror 6", "Pyodide", "basedpyright", "Compiler Explorer", "Godot 4 web"],
      year: "2026",
      source: "https://github.com/ZachSimms/docs",
      featured: true,
    },
  ];
}

/** One job on the resume. */
export interface Job {
  readonly role: string;
  readonly company: string;
  /** E.g. `"2024"`. */
  readonly start: string;
  /** E.g. `"2026"`, or `"now"`. */
  readonly end: string;
  readonly points: readonly string[];
}

/** One school or course on the resume. */
export interface Education {
  readonly title: string;
  readonly school: string;
  readonly year: string;
}

/** The resume page's content. Projects come from {@link listProjects}. */
export const RESUME = {
  /** Two sentences under the heading. */
  summary:
    "[Two lines of summary: what you do, the size of problems you have handled, what you want next.]",
  /** Path of a PDF under `public/` (e.g. `/resume.pdf`); undefined hides the download link. */
  pdf: undefined as string | undefined,
  jobs: [
    {
      role: "[Role]",
      company: "[Company]",
      start: "[yyyy]",
      end: "now",
      points: [
        "[What you shipped, with a number.]",
        "[Scope: team size, users, scale, money.]",
        "[A decision you owned and how it turned out.]",
      ],
    },
    {
      role: "[Role]",
      company: "[Company]",
      start: "[yyyy]",
      end: "[yyyy]",
      points: ["[What you shipped, with a number.]", "[Scope: team size, users, scale, money.]"],
    },
  ] satisfies readonly Job[],
  education: [
    { title: "[Degree]", school: "[School]", year: "[yyyy]" },
  ] satisfies readonly Education[],
  skills: ["[Python]", "[TypeScript]", "[C++]", "[Docker]", "[Linux]"] as readonly string[],
} as const;
