/**
 * @file The "Terminal" control, the event it uses to open the terminal, and the
 * opener `/terminal/` renders.
 *
 * The terminal lives in the root layout; the navigation and footers are rendered by
 * each page. A window event decouples the two, as `SearchLink` does for the palette.
 */

"use client";

import { useEffect } from "react";
import { TERMINAL_KEY } from "@/lib/keys";

/** Name of the `window` event that asks the terminal to open. */
export const OPEN_TERMINAL_EVENT = "open-terminal";

/** What {@link openTerminal} asks for; the event's `detail`. */
export interface OpenTerminalOptions {
  /** Open full screen (`/terminal/` does); otherwise it keeps its size. */
  readonly max?: boolean;
}

/** Ask the terminal to open (and take focus), from anywhere on the client. */
export function openTerminal(options: OpenTerminalOptions = {}): void {
  window.dispatchEvent(new CustomEvent(OPEN_TERMINAL_EVENT, { detail: options }));
}

/** Props for {@link TerminalLink}. */
interface TerminalLinkProps {
  /** Link text; `Terminal` by default. */
  readonly label?: string;
  /** Open full screen. */
  readonly max?: boolean;
}

/** A link-styled button that opens the terminal, for mouse, touch and keyboard users. */
export function TerminalLink({ label = "Terminal", max = false }: TerminalLinkProps) {
  return (
    <button
      type="button"
      className="link"
      aria-label={`${label} (backtick)`}
      aria-keyshortcuts={TERMINAL_KEY}
      onClick={() => openTerminal({ max })}
    >
      <i>{label}</i>
    </button>
  );
}

/**
 * Opens the terminal full screen when rendered: `/terminal/` renders it, so arriving there
 * by a link opens the terminal over whatever page it was docked on. (A direct visit or a
 * reload is handled by the terminal itself, which reads the URL before this runs.)
 */
export function OpenTerminalOnArrival() {
  useEffect(() => openTerminal({ max: true }), []);
  return null;
}
