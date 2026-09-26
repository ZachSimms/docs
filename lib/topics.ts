/**
 * @file The fixed list of topics (top-level sections) and helpers to look them up.
 *
 * Topics are not derived from the filesystem on purpose: their display order and
 * human names are editorial decisions, and each one maps to a `content/<slug>/`
 * folder that holds its cheatsheets.
 */

/** A top-level section of the site. */
export interface Topic {
  /** URL segment and `content/` folder name, lowercase kebab-case. */
  readonly slug: string;
  /** Human-readable name shown in lists and page titles. */
  readonly name: string;
}

/**
 * All topics in display order.
 *
 * The first entry is listed first on the home page and receives the highest
 * number (`15.`); the last entry receives `01.`, mirroring the original site's
 * newest-first numbering.
 */
export const TOPICS: readonly Topic[] = [
  { slug: "math", name: "Math" },
  { slug: "physics", name: "Physics" },
  { slug: "biology", name: "Biology" },
  { slug: "fitness", name: "Fitness" },
  { slug: "economics", name: "Economics" },
  { slug: "ml-ai", name: "ML/AI" },
  { slug: "typescript", name: "TypeScript" },
  { slug: "databases", name: "Databases" },
  { slug: "infrastructure", name: "Infrastructure" },
  { slug: "python", name: "Python" },
  { slug: "cpp", name: "C++" },
  { slug: "game-dev", name: "Game dev" },
  { slug: "robotics", name: "Robotics" },
  { slug: "writing", name: "Writing" },
  { slug: "design", name: "Design" },
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
 * Numbers count down from the list length, so with fifteen topics the first is `15`
 * and the last is `1`.
 *
 * @param slug - The topic slug.
 * @returns The 1-based number, or `undefined` for an unknown slug.
 */
export function topicNumber(slug: string): number | undefined {
  const index = TOPICS.findIndex((t) => t.slug === slug);
  return index === -1 ? undefined : TOPICS.length - index;
}
