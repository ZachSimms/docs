/**
 * @file The fixed list of topics (top-level sections) and helpers to look them up.
 *
 * Topics are not derived from the filesystem on purpose: their human names are
 * editorial decisions, and each one maps to a `content/<slug>/` folder that holds
 * its cheatsheets. The list is alphabetical by name (a unit test enforces it).
 */

/** A top-level section of the site. */
export interface Topic {
  /** URL segment and `content/` folder name, lowercase kebab-case. */
  readonly slug: string;
  /** Human-readable name shown in lists and page titles. */
  readonly name: string;
}

/**
 * All topics, alphabetical by name, ignoring case.
 *
 * The first entry is listed first on the home page and receives the highest
 * number (`22.`); the last entry receives `01.`, mirroring the original site's
 * newest-first numbering.
 */
export const TOPICS: readonly Topic[] = [
  { slug: "3d", name: "3D graphics" },
  { slug: "aviation", name: "Aviation" },
  { slug: "biology", name: "Biology" },
  { slug: "cpp", name: "C++" },
  { slug: "databases", name: "Databases" },
  { slug: "design", name: "Design" },
  { slug: "dsa", name: "DS&A" },
  { slug: "economics", name: "Economics" },
  { slug: "finance", name: "Finance" },
  { slug: "fitness", name: "Fitness" },
  { slug: "game-dev", name: "Game dev" },
  { slug: "infrastructure", name: "Infrastructure" },
  { slug: "leadership", name: "Leadership" },
  { slug: "math", name: "Math" },
  { slug: "ml-ai", name: "ML/AI" },
  { slug: "physics", name: "Physics" },
  { slug: "python", name: "Python" },
  { slug: "robotics", name: "Robotics" },
  { slug: "startups", name: "Startups" },
  { slug: "thinking", name: "Thinking" },
  { slug: "typescript", name: "TypeScript" },
  { slug: "writing", name: "Writing" },
];

/** Just the slugs of {@link TOPICS}, in the same order. */
export const TOPIC_SLUGS: readonly string[] = TOPICS.map((t) => t.slug);

/**
 * Look a topic up by its slug.
 *
 * @param slug - The URL segment, e.g. `"physics"`.
 * @returns The matching topic, or `undefined` if the slug is unknown.
 */
export function getTopic(slug: string): Topic | undefined {
  return TOPICS.find((t) => t.slug === slug);
}

/**
 * The number shown next to a topic on the home page.
 *
 * Numbers count down from the list length, so with twenty-two topics the first is `22`
 * and the last is `1`.
 *
 * @param slug - The topic slug.
 * @returns The 1-based number, or `undefined` for an unknown slug.
 */
export function topicNumber(slug: string): number | undefined {
  const index = TOPICS.findIndex((t) => t.slug === slug);
  return index === -1 ? undefined : TOPICS.length - index;
}
