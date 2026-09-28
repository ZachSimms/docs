/**
 * @file The "Terminal" control and the event it uses to open the terminal.
 *
 * The terminal lives in the root layout; the navigation and footers are rendered by
 * each page. A window event decouples the two, as `SearchLink` does for the palette.
 */

"use client";

import { TERMINAL_KEY } from "@/lib/keys";

/** Name of the `window` event that asks the terminal to open. */
export const OPEN_TERMINAL_EVENT = "open-terminal";

/** Ask the terminal to open (and take focus), from anywhere on the client. */
export function openTerminal(): void {
  window.dispatchEvent(new Event(OPEN_TERMINAL_EVENT));
}

/** A link-styled button that opens the terminal, for mouse, touch and keyboard users. */
export function TerminalLink() {
  return (
    <button
      type="button"
      className="link"
      aria-label="Terminal (backtick)"
      aria-keyshortcuts={TERMINAL_KEY}
      onClick={openTerminal}
    >
      <i>Terminal</i>
    </button>
  );
}
