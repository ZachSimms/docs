/**
 * @file `/site-tree.json`: the terminal's filesystem (every page of the site as a tree)
 * as a static JSON response.
 *
 * `force-static` makes Next prerender it at build time, so the terminal fetches a
 * plain file and the tree never runs on request.
 */
import { buildSiteTree } from "@/lib/terminal/tree";

/** Prerender at build time; never run per request. */
export const dynamic = "force-static";

/** The whole tree as JSON. */
export function GET(): Response {
  return Response.json(buildSiteTree());
}
