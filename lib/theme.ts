/**
 * @file Theme (light/dark) model shared by the toggle button and the root layout.
 *
 * The rules are: a choice stored in `localStorage` wins; otherwise the OS
 * preference applies. The stored choice is written to `<html data-theme>` and
 * the stylesheet keys its color variables off that attribute, falling back to
 * `prefers-color-scheme` when it is absent.
 */

/** The two supported themes. There is no explicit "system" value; absence means system. */
export type Theme = "light" | "dark";

/** `localStorage` key holding the user's explicit choice, if any. */
export const STORAGE_KEY = "theme";

/** Attribute on `<html>` that the CSS reads to override the OS preference. */
export const THEME_ATTRIBUTE = "data-theme";

/**
 * Type guard for {@link Theme}.
 *
 * @param value - Anything, typically a raw `localStorage` value.
 * @returns `true` only for the exact strings `"light"` and `"dark"`.
 */
export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Decide which theme is active.
 *
 * @param stored - The raw stored value, or `null`/`undefined` if nothing is stored.
 * @param prefersDark - Whether `(prefers-color-scheme: dark)` currently matches.
 * @returns The stored theme when valid; otherwise `"dark"` if the OS prefers dark, else `"light"`.
 */
export function resolveTheme(stored: string | null | undefined, prefersDark: boolean): Theme {
  if (isTheme(stored)) return stored;
  return prefersDark ? "dark" : "light";
}

/**
 * The theme a toggle should switch to.
 *
 * @param current - The active theme.
 * @returns The other theme.
 */
export function nextTheme(current: Theme): Theme {
  return current === "dark" ? "light" : "dark";
}

/**
 * Plain JavaScript, inlined into `<body>` by the root layout so it runs before
 * first paint and prevents a flash of the wrong theme.
 *
 * Only a stored override is applied here; with nothing stored the CSS
 * `prefers-color-scheme` rules take over. Errors (for example storage being
 * disabled) are swallowed. The constants are embedded with `JSON.stringify` so
 * the script is always valid regardless of their values.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(STORAGE_KEY)});if(t==="dark"||t==="light"){document.documentElement.setAttribute(${JSON.stringify(THEME_ATTRIBUTE)},t)}}catch(e){}})();`;

/** Attribute on `<html>` set when the page is shown inside the playground's reference panel. */
export const EMBED_ATTRIBUTE = "data-embed";

/**
 * Plain JavaScript, inlined next to {@link THEME_INIT_SCRIPT}: marks
 * `<html data-embed>` when the page is framed (the playground's reference
 * panel), so the CSS hides the site chrome (top bar, `../`, footer) and edge
 * gestures stay off. If reading `window.top` throws, the page is framed by
 * another origin, which the `frame-ancestors 'self'` header already blocks.
 */
export const EMBED_INIT_SCRIPT = `(function(){var framed;try{framed=window.self!==window.top}catch(e){framed=true}if(framed){document.documentElement.setAttribute(${JSON.stringify(EMBED_ATTRIBUTE)},"")}})();`;

/** `localStorage` key remembering zen mode on sheets (`"1"` when on). */
export const ZEN_STORAGE_KEY = "zen";

/** Attribute on `<html>` while zen mode is on; the CSS reads it on pages that offer zen mode. */
export const ZEN_ATTRIBUTE = "data-zen";

/**
 * Inline script run before first paint, like {@link THEME_INIT_SCRIPT}: restores zen
 * mode so a sheet opens without its navigation instead of flashing it first.
 */
export const ZEN_INIT_SCRIPT = `(function(){try{if(localStorage.getItem(${JSON.stringify(ZEN_STORAGE_KEY)})==="1"){document.documentElement.setAttribute(${JSON.stringify(ZEN_ATTRIBUTE)},"")}}catch(e){}})();`;
