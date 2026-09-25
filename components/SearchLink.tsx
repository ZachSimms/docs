/**
 * @file Footer "Search" control and the event it uses to open the palette.
 *
 * The palette lives in the root layout; the footer is rendered by each page.
 * A window event decouples the two so the footer needs no shared state.
 */

"use client";

/** Name of the `window` event that asks {@link SearchPalette} to open. */
export const OPEN_SEARCH_EVENT = "open-search";

/** Ask the search palette to open, from anywhere on the client. */
export function openSearch(): void {
  window.dispatchEvent(new Event(OPEN_SEARCH_EVENT));
}

/**
 * Footer control that opens the palette for mouse, touch and keyboard users.
 *
 * It is a real `<button>` (so Space and Enter both work) styled by
 * `button.link` to look exactly like the site's dotted links.
 */
export function SearchLink() {
  return (
    <button type="button" className="link" aria-label="Search (cmd+k)" onClick={openSearch}>
      <i>Search</i>
    </button>
  );
}
