/**
 * @file Browser-side data for the terminal: the site tree and the pages `cat` and `toc`
 * read, each fetched once per page load and cached.
 */

import { parseMain } from "./page-text";
import { buildFs, isSiteTree, type Fs } from "./vfs";
import { isSitePath } from "@/lib/site";

/** URL of the prerendered tree (see `app/site-tree.json/route.ts`). */
export const SITE_TREE_URL = "/site-tree.json";

/** The tree, fetched once per page load; a failure is forgotten so the next open retries. */
let treeCache: Promise<Fs> | undefined;

/**
 * Fetch, validate and index the site tree.
 *
 * @throws {Error} If the request fails or the file is not a valid tree.
 */
export function loadFs(): Promise<Fs> {
  treeCache ??= fetch(SITE_TREE_URL)
    .then(async (res) => {
      if (!res.ok) throw new Error(`Site tree request failed: ${res.status}`);
      const json: unknown = await res.json();
      if (!isSiteTree(json)) throw new Error("Site tree is malformed");
      return buildFs(json);
    })
    .catch((error: unknown) => {
      treeCache = undefined;
      throw error;
    });
  return treeCache;
}

/** Fetched pages' `<main>`, by href. */
const pageCache = new Map<string, Promise<Element | null>>();

/**
 * The `<main>` of a page of the site, fetched as HTML (the prerendered page, as a
 * first visit would see it).
 *
 * @param href - A path of the site.
 * @returns The element, or `null` when the page could not be loaded; failures are not cached.
 */
export function loadPageMain(href: string): Promise<Element | null> {
  // Only this site's pages: their HTML is rendered in the split.
  if (!isSitePath(href)) return Promise.resolve(null);
  const cached = pageCache.get(href);
  if (cached) return cached;
  const loading = fetch(href, { headers: { accept: "text/html" }, mode: "same-origin" })
    .then(async (res) => (res.ok ? parseMain(await res.text()) : null))
    .catch(() => null)
    .then((main) => {
      if (main === null) pageCache.delete(href);
      return main;
    });
  pageCache.set(href, loading);
  return loading;
}

/** Test seam: forget the cached tree and pages. */
export function resetTerminalCache(): void {
  treeCache = undefined;
  pageCache.clear();
}
