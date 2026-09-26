/**
 * @file Keyboard-shortcut helpers shared by the site's global key handlers:
 * the search palette (`⌘K`, `/`), the theme toggle (`d`), the parent-level
 * shortcut (`Esc`) and the list menus (`↑`/`↓`, `j`/`k`).
 *
 * Everything here is pure or reads the DOM without changing it, so it can be
 * unit-tested without mounting components.
 */

/** Key that toggles the light/dark theme (`ThemeToggle`). */
export const THEME_KEY = "d";
/** Key that goes up one level (`ParentLink`). */
export const UP_KEY = "Escape";
/** Keys that also go up one level (`ParentLink`), when focus allows it: `←` and vim-style `h`. */
export const OUT_KEYS: readonly string[] = ["ArrowLeft", "h"];
/** Keys that open the highlighted row of a list (`NumberedList`): `→` and vim-style `l`. */
export const IN_KEYS: readonly string[] = ["ArrowRight", "l"];

/**
 * Whether `event` is a bare press of any of `keys` (see {@link isPlainKey}).
 *
 * @param event - The keyboard event (or a lookalike).
 * @param keys - Accepted `KeyboardEvent.key` values.
 */
export function isAnyPlainKey(event: KeyLike, keys: readonly string[]): boolean {
  return keys.some((key) => isPlainKey(event, key));
}

/**
 * The shortcuts as listed on `/info/`: `[keys, action]` in display order.
 * Kept here, next to the key constants, so the list cannot drift from them.
 */
export const SHORTCUT_LIST: readonly (readonly [string, string])[] = [
  ["⌘K /", "search"],
  [THEME_KEY, "toggle theme"],
  ["esc ← h", "up a level"],
  ["→ l", "into the highlighted row"],
  ["↑↓ jk", "move in a list"],
  ["enter", "open"],
  // Short enough for a 360px phone: the list is `white-space: pre`.
  ["2×tap ←", "up a level, left edge"],
  ["2×tap →", "into the row, right edge"],
];

/** The subset of `KeyboardEvent` the guards need; lets tests pass plain objects. */
export interface KeyLike {
  readonly key: string;
  readonly metaKey: boolean;
  readonly ctrlKey: boolean;
  readonly altKey: boolean;
  readonly repeat?: boolean;
  readonly defaultPrevented?: boolean;
  readonly target: EventTarget | null;
}

/** Tag names whose keystrokes are text entry. */
const TEXT_ENTRY_TAGS: readonly string[] = ["INPUT", "TEXTAREA", "SELECT"];

/**
 * Whether a keyboard event originated in a text-entry element, in which case
 * single-key shortcuts must not steal the keystroke.
 *
 * @param target - The event target.
 * @returns `true` for inputs, textareas, selects and contenteditable elements.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || TEXT_ENTRY_TAGS.includes(target.tagName);
}

/**
 * Whether `event` is a bare press of `key`: no ⌘/Ctrl/Alt, not auto-repeat,
 * not already handled, and not typed into a field. Shift is expressed by the
 * key itself (`"D"` is not `"d"`), so Shift chords never match lowercase keys.
 *
 * @param event - The keyboard event (or a lookalike).
 * @param key - The exact `KeyboardEvent.key` value, e.g. `"d"` or `"Escape"`.
 * @param options.allowRepeat - Also accept auto-repeat (holding the key), for
 *   movement keys; toggles and navigation keep it off.
 * @returns `true` when the shortcut should fire.
 */
export function isPlainKey(
  event: KeyLike,
  key: string,
  { allowRepeat = false }: { allowRepeat?: boolean } = {},
): boolean {
  return (
    event.key === key &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey &&
    (allowRepeat || !event.repeat) &&
    !event.defaultPrevented &&
    !isTypingTarget(event.target)
  );
}

/**
 * Whether something modal is showing: the search palette (which marks
 * `<body data-search-open>`), the contents menu (`<body data-toc-open>`) or an
 * open `<dialog>`. Page-level shortcuts stay
 * quiet while it is, so `Esc` closes the overlay instead of leaving the page.
 */
export function isOverlayOpen(): boolean {
  return (
    document.body.hasAttribute("data-search-open") ||
    document.body.hasAttribute("data-toc-open") ||
    document.querySelector("dialog[open]") !== null
  );
}

/** Links whose focus still counts as "on the page" for ←/→ (list rows, the pinned `../`). */
const PAGE_LINKS = "nav[data-menu] a, .back-rail a";

/**
 * Whether ←/→ may navigate: focus is on the page itself or on a list row or
 * the back link. Anything else focused (a tab button, a scrollable code box,
 * a summary) keeps its own arrow-key behaviour.
 */
export function arrowsNavigate(): boolean {
  const focused = document.activeElement;
  return focused === null || focused === document.body || focused.matches(PAGE_LINKS);
}

/**
 * The page just left by going up a level, so the parent's list can highlight
 * the row that leads back into it. Module state survives client-side
 * navigation (which is how `ParentLink` navigates) and resets on reload.
 */
let cameFrom: string | null = null;

/** Record the page being left by going up a level (its pathname). */
export function rememberCameFrom(path: string): void {
  cameFrom = path;
}

/** The page last left by going up, or `null`. Reading does not clear it. */
export function peekCameFrom(): string | null {
  return cameFrom;
}

/** Clear the remembered page once a list has used it. */
export function forgetCameFrom(): void {
  cameFrom = null;
}

/**
 * The next highlighted row in a menu of `length` rows, wrapping at both ends.
 *
 * @param current - The highlighted row, or `null` when nothing is highlighted.
 * @param delta - `1` to move down, `-1` to move up.
 * @param length - Number of rows.
 * @returns The new row index, or `null` for an empty menu. With nothing
 *   highlighted, down starts at the first row and up at the last.
 * @example
 * nextIndex(null, 1, 3); // 0
 * nextIndex(2, 1, 3);    // 0 (wraps)
 */
export function nextIndex(current: number | null, delta: 1 | -1, length: number): number | null {
  if (length === 0) return null;
  if (current === null || current >= length) return delta === 1 ? 0 : length - 1;
  return (current + delta + length) % length;
}
