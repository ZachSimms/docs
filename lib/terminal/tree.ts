/**
 * @file Build-time construction of the terminal's filesystem: the whole site as one tree.
 *
 * Server only (reads `content/` and `posts/`). The route handler at `/site-tree.json`
 * serializes {@link buildSiteTree} once at build time; the terminal fetches that JSON
 * the first time it opens and walks it with `lib/terminal/vfs.ts`.
 *
 * The tree follows the site's own levels, not its URLs: `~/docs/python/overview` is
 * `/python/overview/`, because `../` from a topic leads to `/docs/`. Every node carries
 * its `href`, so the terminal can map the page being read back to its place in the tree,
 * and pages written in MDX carry their `source` for the `md` pane.
 */

import { CONTENT_ROOT, groupHref, listGroupSheets, listTopicEntries, sheetHref } from "../content";
import { listPosts, postHref, POSTS_ROOT } from "../posts";
import { listProjects, PROFILE } from "../profile";
import { SECTIONS } from "../sections";
import { groupSourceHref, postSourceHref, sheetSourceHref } from "./source";
import { TOPICS, type Topic } from "../topics";
import type { SiteTree, TreeNode } from "./vfs";

/** Where the builder reads from; overridable for tests. */
export interface TreeRoots {
  readonly content?: string;
  readonly posts?: string;
  readonly topics?: readonly Topic[];
}

/** Name of the every-sheet list (`/sheets/`) inside `~/docs`. */
export const SHEETS_NODE = "sheets";

/**
 * A project name as a path segment: lowercase kebab-case, apostrophes dropped.
 *
 * @example
 * projectSegment("Zach's Docs"); // "zachs-docs"
 */
export function projectSegment(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** One topic: its directories (each with its sheets) and loose sheets, in display order. */
function topicNode({ slug, name }: Topic, content: string): TreeNode {
  return {
    name: slug,
    title: name,
    href: `/${slug}/`,
    kind: "dir",
    children: listTopicEntries(slug, content).map((entry): TreeNode => {
      if (entry.kind === "sheet") {
        return {
          name: entry.slug,
          title: entry.title,
          href: sheetHref(entry),
          kind: "page",
          date: entry.date,
          source: sheetSourceHref(entry),
        };
      }
      return {
        name: entry.slug,
        title: entry.title,
        href: groupHref(entry),
        kind: "dir",
        date: entry.date,
        source: groupSourceHref(entry),
        children: listGroupSheets(slug, entry.slug, content).map((sheet) => ({
          name: sheet.slug,
          title: sheet.title,
          href: sheetHref(sheet),
          kind: "page" as const,
          date: sheet.date,
          source: sheetSourceHref(sheet),
        })),
      };
    }),
  };
}

/** The children of one top-level section; `undefined` for sections that are single pages. */
function sectionChildren(key: string, roots: Required<TreeRoots>): TreeNode[] | undefined {
  switch (key) {
    case "projects":
      return listProjects().map((project) => ({
        name: projectSegment(project.name),
        title: project.name,
        // A project without a page or a live URL still links to its source, if public.
        href: project.href ?? project.source ?? "/projects/",
        kind: "link" as const,
        ...(project.year ? { date: project.year } : {}),
        note: project.description,
      }));
    case "blog":
      return listPosts(roots.posts).map((post) => ({
        name: post.slug,
        title: post.title,
        href: postHref(post),
        kind: "page" as const,
        date: post.date,
        source: postSourceHref(post),
        ...(post.summary ? { note: post.summary } : {}),
      }));
    case "docs":
      return [
        ...roots.topics.map((topic) => topicNode(topic, roots.content)),
        { name: SHEETS_NODE, title: "Every sheet, newest first", href: "/sheets/", kind: "page" },
      ];
    default:
      return undefined;
  }
}

/**
 * The whole site as a tree rooted at home (`~`), plus the profile `whoami` prints.
 *
 * The home page's children are the sections in navigation order; Projects, Blog and
 * Docs are directories, the rest are pages. Projects are `link` nodes: they point at a
 * page of this site, a live URL or a repository.
 *
 * @param roots - Content and posts folders and the topic list; default to the site's own.
 * @throws {Error} On invalid content, as the content and post loaders do.
 */
export function buildSiteTree(roots: TreeRoots = {}): SiteTree {
  const all: Required<TreeRoots> = {
    content: roots.content ?? CONTENT_ROOT,
    posts: roots.posts ?? POSTS_ROOT,
    topics: roots.topics ?? TOPICS,
  };
  const children = SECTIONS.filter(({ key }) => key !== "home").map(({ key, label, href }) => {
    const nested = sectionChildren(key, all);
    return nested
      ? { name: key, title: label, href, kind: "dir" as const, children: nested }
      : { name: key, title: label, href, kind: "page" as const };
  });
  return {
    root: { name: "", title: "Home", href: "/", kind: "dir", children },
    profile: {
      name: PROFILE.name,
      fullName: PROFILE.fullName,
      role: PROFILE.role,
      bio: PROFILE.bio,
      links: [
        { label: "GitHub", href: PROFILE.github },
        { label: "LinkedIn", href: PROFILE.linkedin },
        ...(PROFILE.email ? [{ label: "Email", href: `mailto:${PROFILE.email}` }] : []),
      ],
    },
  };
}
