/**
 * @file Everything personal the Home, Projects and Resume pages show, in one place.
 *
 * The resume below is transcribed from Zach's resume PDF. The PDF itself is not
 * published yet: set `RESUME.pdf` once a copy for the web (without the phone number)
 * is in `public/`. A resume section with no entries is not rendered, so a page never
 * shows an empty heading.
 */

import { listAllSheets } from "./content";
import { DOCS_TITLE } from "./site";
import { TOPICS } from "./topics";

/** Who the site is about. */
export const PROFILE = {
  /** The start of every `<title>`. */
  name: "Zach",
  /** Home page heading; the resume prints it too. */
  fullName: "Zach Simms",
  /** Current role, printed under the name on the resume. */
  role: "Software Engineer",
  /** Home page introduction: two or three sentences. */
  bio: "Just another builder 👋",
  github: "https://github.com/ZachSimms",
  linkedin: "https://www.linkedin.com/in/zachsimms97",
  /** Shown as an Email link in the navigation and on the resume; undefined hides it. */
  email: "zachsimms97@gmail.com" as string | undefined,
} as const;

/** One project card. */
export interface Project {
  readonly name: string;
  /** Where the name links (an internal page or a live URL); none renders plain text. */
  readonly href?: string;
  readonly description: string;
  readonly stack: readonly string[];
  readonly year?: string;
  /** Source repository, if public. */
  readonly source?: string;
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
 * Every project: this site's two, then those on the resume. The docs description is
 * built from live counts, so it never goes stale as sheets are added.
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
    },
    {
      name: "Playground",
      href: "/playground/",
      description:
        "Write and run C++, Rust, Python, JavaScript, TypeScript, HTML/CSS and GDScript projects in the browser, with the reference sheets beside the code.",
      stack: ["CodeMirror 6", "Pyodide", "basedpyright", "Compiler Explorer", "Godot 4 web"],
      year: "2026",
      source: "https://github.com/ZachSimms/docs",
    },
    ...RESUME.projects,
  ];
}

/** One job on the resume. */
export interface Job {
  readonly role: string;
  readonly company: string;
  /** E.g. `"Oct 2024"`. */
  readonly start: string;
  /** E.g. `"May 2024"`, or `"Present"`. */
  readonly end: string;
  readonly points: readonly string[];
}

/** A degree on the resume. */
export interface Education {
  readonly school: string;
  readonly degree: string;
  /** Graduation, e.g. `"May 2024"`. */
  readonly date: string;
  readonly note?: string;
}

/** A role outside work (clubs, student government). */
export interface Involvement {
  readonly name: string;
  readonly role: string;
  readonly start: string;
  readonly end: string;
  readonly summary: string;
}

/** The resume page's content, in the PDF's order. */
export const RESUME = {
  /** A PDF under `public/` (e.g. `/docs/resume.pdf`), linked as "Download PDF"; undefined hides the link. */
  pdf: undefined as string | undefined,
  education: [
    {
      school: "University of Nebraska Omaha",
      degree: "B.S. in Computer Science",
      date: "May 2024",
      note: "GPA: 3.6",
    },
  ] satisfies readonly Education[] as readonly Education[],
  jobs: [
    {
      role: "Software Engineer",
      company: "Science Applications International Corporation (SAIC)",
      start: "Oct 2024",
      end: "Present",
      points: [
        "Designed and shipped a TypeScript agentic SDK against the DoD’s OpenAI-compatible inference API, implementing a prompt-based tool-calling protocol to work around the platform’s lack of native function calling, plus multi-agent orchestration, human-in-the-loop approval checkpoints, and a CLI coding agent.",
        "Replatformed 2 locally hosted Rancher Kubernetes Engine 2 (RKE2) applications into AWS GovCloud, re-architecting NFS file I/O onto S3 object storage and converting synchronous workflows to SQS/SNS event-driven processing with no loss of data integrity or functionality.",
        "Led UI modernization of a TypeScript/React application serving 20,000 personnel across the US Department of War (DoW).",
        "Transitioned legacy pages to be editable by user with role-based access control (RBAC) using Keycloak OpenID Connect (OIDC) authentication.",
        "Containerized services with Kubernetes and Helm and ensured monitoring with Splunk.",
        "Hand picked from outside the agency to be 1 of 10 alpha testers for the DoW Catalyst Forge (AI development platform) run by the Army CDAIO based on contributions to the GenAI development collaboration forum.",
      ],
    },
    {
      role: "Software Engineering Intern",
      company: "Kiewit",
      start: "Summer 2023",
      end: "Summer 2023",
      points: [
        "Built the 2nd version of Kiewit’s internal news app in React, TypeScript, Redux Toolkit, and Ionic, implementing authentication, news feed, and article detail pages.",
        "Owned features end-to-end from sprint planning through demo, collaborating with design, QA, PM, and business analyst stakeholders while writing unit tests to achieve 80%+ code coverage.",
      ],
    },
    {
      role: "Recitation Instructor & Peer Tutor",
      company: "UNO College of IS&T",
      start: "Jan 2022",
      end: "May 2024",
      points: [
        "Led recitation sessions for Intro to Computer Science 1, reinforcing lecture material for 12 students per section.",
        "Provided one-on-one tutoring across 4 semesters, adapting explanations to individual learning gaps in all undergrad Comp Sci topics.",
      ],
    },
  ] satisfies readonly Job[] as readonly Job[],
  /** Projects from the resume (the site's own come first in {@link listProjects}). */
  projects: [
    {
      name: "3D Algorithm Visualizer",
      description:
        "Built an interactive React/Three.js application rendering real-time 3D visualizations of pathfinding algorithms (A*, BFS/DFS), letting users set start/end nodes and place obstacles to compare algorithm behavior live.",
      stack: ["React", "Three.js"],
    },
  ] satisfies readonly Project[] as readonly Project[],
  activities: [
    {
      name: "MavLabs",
      role: "Founder & President",
      start: "Apr 2022",
      end: "May 2023",
      summary:
        "Founded and grew a student engineering club to 60+ members, recruiting and managing 3 officers while launching 4 collaborative technical projects.",
    },
    {
      name: "UNO Student Government",
      role: "Senator",
      start: "Aug 2022",
      end: "May 2023",
      summary:
        "Sole elected senator representing the College of IS&T student body; drove Outreach Committee initiatives to increase student legislative participation.",
    },
  ] satisfies readonly Involvement[] as readonly Involvement[],
  skills: {
    tools: [
      "Cursor",
      "Claude Code",
      "Greptile",
      "AWS",
      "Kubernetes",
      "Helm",
      "Docker",
      "Splunk",
      "Neon",
      "Atlassian Suite (Jira, Confluence)",
      "Git",
      "Reactjs",
      "Tailwind CSS",
    ],
    languages: ["Python", "JavaScript", "TypeScript", "C"],
  } as { readonly tools: readonly string[]; readonly languages: readonly string[] },
} as const;
