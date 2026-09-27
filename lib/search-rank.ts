/**
 * @file Search ranking, shared by the server (types) and the client palette (logic).
 *
 * This module must stay free of Node APIs: it is bundled into the browser and
 * runs on every keystroke in the ⌘K palette. Index construction lives in
 * `lib/search.ts`.
 */

/** One searchable document, i.e. one cheatsheet, as stored in `/search-index.json`. */
export interface SearchDoc {
  /** Topic slug. */
  readonly topic: string;
  /** Sheet slug; not unique within a topic once sheets live in directories, so {@link SearchDoc.url} is the identity. */
  readonly slug: string;
  /** Frontmatter title. */
  readonly title: string;
  /**
   * Absolute site path with trailing slash, e.g. `"/python/overview/"` or
   * `"/typescript/backend/websockets/"`; also what the path weight matches against.
   */
  readonly url: string;
  /** Heading texts in document order, without `#` markers. */
  readonly headings: readonly string[];
  /** Body text with Markdown syntax stripped and code fences removed; may be truncated. */
  readonly text: string;
}

/** A matching document with its relevance score. */
export interface SearchHit {
  readonly doc: SearchDoc;
  /** Sum of per-token weights; higher is better. */
  readonly score: number;
}

/** Points awarded per query token for a match in each field. */
const WEIGHT = { title: 3, path: 2, heading: 2, body: 1 } as const;

/**
 * Split a query into lowercase search tokens.
 *
 * @param query - Raw user input.
 * @returns Non-empty, lowercased, whitespace-separated tokens; `[]` for blank input.
 */
export function tokenize(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * The display path of a document: its URL without the outer slashes, e.g.
 * `"python/overview"` or `"typescript/backend/websockets"`. Shown in the
 * palette and matched by the path weight.
 */
export function docPath(doc: Pick<SearchDoc, "url">): string {
  return doc.url.replace(/^\/|\/$/g, "");
}

/** A document with its searchable fields lowercased once, so scoring is cheap per token. */
interface Lowered {
  readonly doc: SearchDoc;
  readonly title: string;
  /** The URL without its outer slashes: `topic/slug` or `topic/directory/slug`. */
  readonly path: string;
  /** All headings joined with newlines. */
  readonly headings: string;
  readonly text: string;
}

/** Precompute the lowercase view of a document. */
function lower(doc: SearchDoc): Lowered {
  return {
    doc,
    title: doc.title.toLowerCase(),
    path: docPath(doc).toLowerCase(),
    headings: doc.headings.join("\n").toLowerCase(),
    text: doc.text.toLowerCase(),
  };
}

/**
 * Lowercased views per index array. Lowercasing every document is most of a
 * search's cost, and the index never changes once loaded, so it is done once
 * per array instead of on every keystroke.
 */
const loweredIndexes = new WeakMap<readonly SearchDoc[], readonly Lowered[]>();

/** The lowercased view of `docs`, computed on first use. */
function lowerAll(docs: readonly SearchDoc[]): readonly Lowered[] {
  let lowered = loweredIndexes.get(docs);
  if (!lowered) {
    lowered = docs.map(lower);
    loweredIndexes.set(docs, lowered);
  }
  return lowered;
}

/**
 * Score one token against one document: the sum of {@link WEIGHT}s for every
 * field that contains the token as a substring. `0` means no field matched.
 */
function scoreToken(entry: Lowered, token: string): number {
  return (
    (entry.title.includes(token) ? WEIGHT.title : 0) +
    (entry.path.includes(token) ? WEIGHT.path : 0) +
    (entry.headings.includes(token) ? WEIGHT.heading : 0) +
    (entry.text.includes(token) ? WEIGHT.body : 0)
  );
}

/**
 * Rank documents against a query.
 *
 * A document matches only if every token matches at least one of its fields.
 * Results are ordered by score (descending), then title, then URL, so the order
 * is deterministic. Neither `docs` nor its elements are mutated, and they must
 * not be mutated by the caller either: their lowercased view is cached per array.
 *
 * @param docs - The full index.
 * @param query - Raw user input; blank input yields no results.
 * @param limit - Maximum number of hits to return.
 * @returns At most `limit` hits, best first.
 */
export function rankSearch(docs: readonly SearchDoc[], query: string, limit = 10): SearchHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const hits = lowerAll(docs).flatMap((entry) => {
    const scores = tokens.map((token) => scoreToken(entry, token));
    if (scores.some((s) => s === 0)) return [];
    return [{ doc: entry.doc, score: scores.reduce((a, b) => a + b, 0) }];
  });

  return [...hits]
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.doc.title.localeCompare(b.doc.title) ||
        a.doc.url.localeCompare(b.doc.url),
    )
    .slice(0, limit);
}
