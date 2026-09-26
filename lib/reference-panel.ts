/**
 * @file How the rest of the site hands a sheet to the playground's reference panel.
 *
 * On `/playground/`, choosing a ⌘K result shouldn't navigate away from the
 * code: the palette dispatches {@link OPEN_REFERENCE_EVENT} instead and the
 * panel opens the sheet beside the editor.
 */

/** Window event whose `detail.url` is the sheet to open in the reference panel. */
export const OPEN_REFERENCE_EVENT = "open-reference";

/** The playground's route. */
export const PLAYGROUND_PATH = "/playground/";

/** Whether `pathname` is the playground (with or without the trailing slash). */
export function isPlaygroundPath(pathname: string): boolean {
  return pathname === PLAYGROUND_PATH || pathname === PLAYGROUND_PATH.slice(0, -1);
}

/** Ask the reference panel to show a sheet. */
export function openReference(url: string): void {
  window.dispatchEvent(new CustomEvent(OPEN_REFERENCE_EVENT, { detail: { url } }));
}

/** Only site-relative sheet URLs (never the playground itself) are opened in the panel's same-origin frame. */
export function isSheetUrl(url: unknown): url is string {
  return (
    typeof url === "string" &&
    /^\/[a-z0-9-]+(?:\/[a-z0-9-]+){0,2}\/(?:#[\w-]+)?$/.test(url) &&
    !url.startsWith("/playground/")
  );
}

/** Window event whose `detail` is a {@link DocRequest}: show that official docs page in the panel's Docs tab. */
export const OPEN_DOCS_EVENT = "open-docs";

/** A docs page to show: a DevDocs docset, a page path in it, and a title. */
export interface DocRequest {
  readonly slug: string;
  readonly path: string;
  readonly name: string;
}

/** Ask the reference panel to show an official docs page (from an editor hover). */
export function openDocs(request: DocRequest): void {
  window.dispatchEvent(new CustomEvent(OPEN_DOCS_EVENT, { detail: request }));
}

/** A valid {@link DocRequest}, or `null`: event details are untrusted. */
export function parseDocRequest(detail: unknown): DocRequest | null {
  if (typeof detail !== "object" || detail === null) return null;
  const { slug, path, name } = detail as Record<string, unknown>;
  if (typeof slug !== "string" || !/^[a-z0-9][\w.~-]{0,40}$/.test(slug)) return null;
  if (
    typeof path !== "string" ||
    path.length > 300 ||
    !/^[\w@%~.:+-]+(?:\/[\w@%~.:+-]+)*(?:#[^\s#]*)?$/.test(path)
  )
    return null;
  if (
    path
      .split("#")[0]!
      .split("/")
      .some((part) => part === ".." || part === ".")
  )
    return null;
  if (typeof name !== "string" || name.length === 0 || name.length > 200) return null;
  return { slug, path, name };
}
