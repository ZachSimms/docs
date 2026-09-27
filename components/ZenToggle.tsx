/**
 * @file Zen mode on sheets and posts: the page shows only the sheet and, on the left,
 * its table of contents. The navigation, breadcrumbs and footer are hidden by CSS
 * while `<html data-zen>` is set.
 *
 * Client component rendered beside the pinned `../` on pages that offer zen mode. The
 * `zen` button and the `z` key toggle it; the choice is remembered in `localStorage`
 * and restored before first paint by `ZEN_INIT_SCRIPT`.
 */

"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ZEN_KEY, isOverlayOpen, isPlainKey } from "@/lib/keys";
import { ZEN_ATTRIBUTE, ZEN_STORAGE_KEY } from "@/lib/theme";

/** Window event fired after {@link setZen}, so every subscriber re-reads the state. */
const CHANGE_EVENT = "zenchange";

/** Whether zen mode is on, read from `<html>`. */
function isZen(): boolean {
  return document.documentElement.hasAttribute(ZEN_ATTRIBUTE);
}

/** Re-render on changes in this tab. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** Server snapshot: unknown until hydrated. */
function getServerSnapshot(): boolean | null {
  return null;
}

/**
 * Turn zen mode on or off: set or clear `<html data-zen>`, remember the choice
 * (when storage is available) and notify subscribers.
 */
export function setZen(on: boolean): void {
  document.documentElement.toggleAttribute(ZEN_ATTRIBUTE, on);
  try {
    if (on) localStorage.setItem(ZEN_STORAGE_KEY, "1");
    else localStorage.removeItem(ZEN_STORAGE_KEY);
  } catch {
    // Private mode or storage disabled: zen still applies for this page.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** The `zen` switch: a link-styled button, underlined solid while zen mode is on. */
export function ZenToggle() {
  const zen = useSyncExternalStore(subscribe, isZen, getServerSnapshot);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isPlainKey(event, ZEN_KEY) || isOverlayOpen()) return;
      event.preventDefault();
      setZen(!isZen());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <button
      type="button"
      className="link zen-toggle"
      aria-pressed={zen ?? false}
      aria-keyshortcuts={ZEN_KEY}
      title={zen ? "Leave zen mode (z)" : "Zen mode: only the sheet and its contents (z)"}
      onClick={() => setZen(!isZen())}
    >
      <i>zen</i>
    </button>
  );
}
