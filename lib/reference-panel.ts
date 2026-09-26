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
