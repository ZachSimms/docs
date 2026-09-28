/**
 * @file Blog post loader: reads `posts/<slug>.mdx`, newest first.
 *
 * Server/build-time only (uses `node:fs`). Mirrors `lib/content.ts`: frontmatter is
 * validated with Zod at build time, `_`- and `.`-prefixed files are drafts and never
 * listed, and every slug that reaches the filesystem must be lowercase kebab-case.
 * The MDX body is compiled by the page through a dynamic `import()`.
 */

import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { isPartial, isValidSegment, parseMatter } from "./content";
import { postSchema } from "./schema";

/** Where posts live. */
export const POSTS_ROOT = path.join(process.cwd(), "posts");

/** Words per minute used for the reading-time estimate. */
const WORDS_PER_MINUTE = 200;

/** One blog post, as listed on `/blog/` and the home page. */
export interface Post {
  /** URL segment and file name without `.mdx`. */
  readonly slug: string;
  readonly title: string;
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly summary?: string;
  readonly tags: readonly string[];
  /** Estimated minutes to read, at least 1. */
  readonly minutes: number;
}

/** Posts in one calendar year, for the archive list. */
export interface PostYear {
  readonly year: string;
  readonly posts: readonly Post[];
}

/**
 * Estimate reading time from a Markdown body.
 *
 * @param body - Post body without frontmatter.
 * @returns Whole minutes at {@link WORDS_PER_MINUTE}, never less than 1.
 */
export function readingMinutes(body: string): number {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

/**
 * Read and validate one post file.
 *
 * @throws {Error} Naming the file when its frontmatter is invalid.
 */
function readPost(dir: string, file: string): Post {
  const fullPath = path.join(dir, file);
  const { data, content } = parseMatter(fs.readFileSync(fullPath, "utf8"));
  const parsed = postSchema.safeParse(data);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid frontmatter in ${fullPath}: ${issues}`);
  }
  const { title, date, summary, tags } = parsed.data;
  return {
    slug: file.replace(/\.mdx$/, ""),
    title,
    date,
    ...(summary === undefined ? {} : { summary }),
    tags: tags ?? [],
    minutes: readingMinutes(content),
  };
}

/**
 * Every published post, newest first (ties broken by slug so the order is stable).
 *
 * Memoised per root for the lifetime of a render or build. A missing folder means
 * no posts rather than an error.
 *
 * @param root - Posts folder; overridable for tests.
 * @throws {Error} If a post has invalid frontmatter or a file name that is not kebab-case.
 */
export const listPosts = cache((root: string = POSTS_ROOT): Post[] => {
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx") && !isPartial(entry.name))
    .map((entry) => {
      const slug = entry.name.replace(/\.mdx$/, "");
      if (!isValidSegment(slug)) {
        throw new Error(
          `Post file name "${path.join(root, entry.name)}" must be lowercase kebab-case`,
        );
      }
      return readPost(root, entry.name);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
});

/**
 * One post by slug.
 *
 * @returns The post, or `undefined` for an unknown or unsafe slug.
 */
export function getPost(slug: string, root: string = POSTS_ROOT): Post | undefined {
  if (!isValidSegment(slug)) return undefined;
  return listPosts(root).find((post) => post.slug === slug);
}

/**
 * The Markdown body of a post (frontmatter removed).
 *
 * @throws {Error} If the slug is unsafe or the file cannot be read.
 */
export function readPostBody(slug: string, root: string = POSTS_ROOT): string {
  if (!isValidSegment(slug)) throw new Error(`Invalid post slug: ${slug}`);
  return parseMatter(fs.readFileSync(path.join(root, `${slug}.mdx`), "utf8")).content;
}

/**
 * Group posts by calendar year, newest year first, keeping each year's order.
 *
 * @param posts - Posts newest first, as {@link listPosts} returns them.
 */
export function postsByYear(posts: readonly Post[]): PostYear[] {
  const years: { year: string; posts: Post[] }[] = [];
  for (const post of posts) {
    const year = post.date.slice(0, 4);
    const last = years.at(-1);
    if (last?.year === year) last.posts.push(post);
    else years.push({ year, posts: [post] });
  }
  return years;
}

/** URL of a post page. */
export function postHref(post: Pick<Post, "slug">): string {
  return `/blog/${post.slug}/`;
}
