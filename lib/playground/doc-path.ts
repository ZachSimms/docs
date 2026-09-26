/**
 * @file Docs page paths (`global_objects/array/map#syntax`): splitting and validating them.
 *
 * Pure and dependency-free, so `lib/reference-panel.ts` (in every page's
 * bundle) can validate docs requests without loading the docs module.
 */

/** Split `path#fragment`. */
export function splitFragment(path: string): { page: string; fragment: string | null } {
  const hash = path.indexOf("#");
  return hash === -1
    ? { page: path, fragment: null }
    : { page: path.slice(0, hash), fragment: path.slice(hash + 1) || null };
}

/** One path segment: what DevDocs paths use (`operator*`, `data-*`, `calc()`, `%40`), never quotes, `<>` or spaces. */
const SEGMENT = "[\\w@%~.:+=*()-]+";
const DOC_PATH = new RegExp(`^${SEGMENT}(?:/${SEGMENT})*(?:#[\\w.:%~+=*()-]*)?$`);

/**
 * Whether `path` is a safe docset page path (optionally with a `#fragment`):
 * the allowed characters, no `.` or `..` segments, at most 300 characters.
 * Index entries, followed links and hover requests all pass through this.
 */
export function isDocPath(path: string): boolean {
  return (
    path.length <= 300 &&
    DOC_PATH.test(path) &&
    !splitFragment(path)
      .page.split("/")
      .some((part) => part === "." || part === "..")
  );
}
