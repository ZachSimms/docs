/**
 * @file Client-side access to the prerendered search index, shared by the ⌘K
 * palette and the playground's reference panel.
 */

import { z } from "zod";
import type { SearchDoc } from "@/lib/search-rank";

/** The index's shape, checked on arrival (it's the site's own file, but still a boundary). */
const searchIndexSchema = z.array(
  z.object({
    topic: z.string(),
    slug: z.string(),
    title: z.string(),
    url: z.string(),
    headings: z.array(z.string()),
    text: z.string(),
  }),
);

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
      return searchIndexSchema.parse(await res.json()) satisfies SearchDoc[];
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
