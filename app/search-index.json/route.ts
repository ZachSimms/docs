/**
 * @file `/search-index.json`: the search index as a static JSON response.
 *
 * `force-static` makes Next prerender it at build time, so the palette fetches
 * a plain file and the index never runs on request.
 */
import { buildSearchIndex } from "@/lib/search";

/** Prerender at build time; never run per request. */
export const dynamic = "force-static";

/** The full index as JSON. */
export function GET(): Response {
  return Response.json(buildSearchIndex());
}
