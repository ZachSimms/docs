/**
 * @file Client-side access to the prerendered search index, shared by the ⌘K
 * palette and the playground's reference panel.
 */

import type { SearchDoc } from "@/lib/search-rank";

/** String fields every indexed doc has. */
const STRING_FIELDS = ["topic", "slug", "title", "url", "text"] as const;

/**
 * Whether `value` is a valid index: the site's own file, but still a boundary.
 *
 * Hand-written rather than a zod schema: this module is loaded by the ⌘K palette
 * on every page, and zod alone is ~85 KB gzipped of first-load JS.
 */
export function isSearchIndex(value: unknown): value is SearchDoc[] {
  return (
    Array.isArray(value) &&
    value.every(
      (doc: unknown) =>
        typeof doc === "object" &&
        doc !== null &&
        STRING_FIELDS.every((key) => typeof (doc as Record<string, unknown>)[key] === "string") &&
        Array.isArray((doc as { headings?: unknown }).headings) &&
        (doc as { headings: unknown[] }).headings.every((h) => typeof h === "string"),
    )
  );
}

/** URL of the prerendered search index (see `app/search-index.json/route.ts`). */
export const SEARCH_INDEX_URL = "/search-index.json";

/** Module-level cache so the index is fetched once per page load, not once per open. */
let indexCache: Promise<SearchDoc[]> | undefined;

/**
 * Fetch and cache the search index.
 *
 * A failed request clears the cache so the next call retries instead of
 * remembering the failure for the rest of the session.
 *
 * @throws {Error} If the response is not OK or not a valid index; the rejection is
 *   cached-and-cleared as described.
 */
export function loadSearchIndex(): Promise<SearchDoc[]> {
  indexCache ??= fetch(SEARCH_INDEX_URL)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Search index request failed: ${res.status}`);
      const json: unknown = await res.json();
      if (!isSearchIndex(json)) throw new Error("Search index is malformed");
      return json;
    })
    .catch((error: unknown) => {
      indexCache = undefined; // allow a retry on the next call
      throw error;
    });
  return indexCache;
}

/** Test seam: forget the cached index. */
export function resetSearchIndexCache(): void {
  indexCache = undefined;
}
