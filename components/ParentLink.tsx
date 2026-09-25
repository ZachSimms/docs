/**
 * @file The pinned `../` link, which also answers `Esc`, `←` and `h`.
 *
 * Client component rendered by `Page` in its back rail. Pressing `Esc`, or `←`
 * / `h` while focus is on the page or a list row (not in a text field, not while the
 * search palette or a dialog is open, and not when another handler already
 * claimed the key) clicks the link, so navigation goes through next/link
 * exactly as a mouse click would. Every use of the link records the page being
 * left, so the parent's list highlights the row that leads back (`→` re-enters).
 */

"use client";

import { useEffect, useRef } from "react";
import {
  OUT_KEYS,
  UP_KEY,
  arrowsNavigate,
  isAnyPlainKey,
  isOverlayOpen,
  isPlainKey,
  rememberCameFrom,
} from "@/lib/keys";
import { DottedLink } from "./DottedLink";

/** Props for {@link ParentLink}. */
interface ParentLinkProps {
  /** The parent level's URL. */
  href: string;
  /** Link text, normally `../`. */
  label: string;
  /** Screen-reader description, e.g. "Back to TypeScript". */
  ariaLabel?: string;
}

/** Whether a keydown should take the reader up a level. */
function isUpKey(event: KeyboardEvent): boolean {
  if (isOverlayOpen()) return false;
  return isPlainKey(event, UP_KEY) || (isAnyPlainKey(event, OUT_KEYS) && arrowsNavigate());
}

/**
 * Render a {@link DottedLink} to the parent level and follow it on `Esc`, `←` or `h`.
 */
export function ParentLink({ href, label, ariaLabel }: ParentLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isUpKey(event)) return;
      event.preventDefault();
      ref.current?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <DottedLink
      ref={ref}
      href={href}
      ariaLabel={ariaLabel}
      aria-keyshortcuts={[UP_KEY, ...OUT_KEYS].join(" ")}
      onClick={() => rememberCameFrom(window.location.pathname)}
    >
      {label}
    </DottedLink>
  );
}
