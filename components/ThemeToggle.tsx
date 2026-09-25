/**
 * @file Light/dark theme switch.
 *
 * Client component. Reads the active theme from `localStorage` and the OS
 * preference through `useSyncExternalStore`, writes the user's choice back to
 * `localStorage` and `<html data-theme>`, and renders a monochrome sun or
 * moon pinned to the top of the viewport. Pressing `d` anywhere (outside a
 * text field) toggles too. The rules live in `lib/theme.ts`.
 */

"use client";

import { useEffect, useSyncExternalStore } from "react";
import { THEME_KEY, isPlainKey } from "@/lib/keys";
import { STORAGE_KEY, THEME_ATTRIBUTE, nextTheme, resolveTheme, type Theme } from "@/lib/theme";

/** Window event fired after {@link applyTheme}, so every subscriber re-reads the theme. */
const CHANGE_EVENT = "themechange";
/** Media query for the OS dark-mode preference. */
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** The raw stored value, or `null` when storage is empty or inaccessible. */
function readStored(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Whether the OS currently prefers dark; `false` where `matchMedia` is unavailable. */
function prefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

/**
 * `useSyncExternalStore` subscription: re-render on OS preference changes,
 * on {@link applyTheme} in this tab, and on `storage` events from other tabs.
 *
 * @returns The unsubscribe function.
 */
function subscribe(onChange: () => void): () => void {
  const media = typeof window.matchMedia === "function" ? window.matchMedia(DARK_QUERY) : undefined;
  media?.addEventListener("change", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    media?.removeEventListener("change", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** Client snapshot: the theme currently in effect. */
function getSnapshot(): Theme {
  return resolveTheme(readStored(), prefersDark());
}

/** Server snapshot: unknown, so SSR and the first client render agree on "no icon". */
function getServerSnapshot(): Theme | null {
  return null;
}

/**
 * Make `theme` the active theme: persist it, set `<html data-theme>` so the
 * CSS switches immediately, and notify subscribers.
 *
 * Persisting can fail (private mode, storage disabled); the theme still
 * applies for the current page in that case.
 */
export function applyTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode or storage disabled: the choice still applies for this page.
  }
  document.documentElement.setAttribute(THEME_ATTRIBUTE, theme);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Crescent moon, filled with `currentColor`; shown in light mode ("switch to dark"). */
function MoonIcon() {
  return (
    <svg data-icon="moon" viewBox="0 0 24 24" width="1.1em" height="1.1em" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" fill="currentColor" />
    </svg>
  );
}

/** Sun with eight rays, stroked in `currentColor`; shown in dark mode ("switch to light"). */
function SunIcon() {
  return (
    <svg
      data-icon="sun"
      viewBox="0 0 24 24"
      width="1.1em"
      height="1.1em"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
    </svg>
  );
}

/**
 * Theme switch pinned to the top of the viewport, aligned with the right edge
 * of the content column (the `.theme-toggle-rail` reuses the body grid).
 *
 * Shows the mode you would switch *to*: a moon in light mode, a sun in dark
 * mode. The button carries `data-target` with that mode and a `title` such as
 * "Switch to dark mode". Renders an empty button until hydrated so the server
 * never guesses the theme.
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const target = theme === null ? null : nextTheme(theme);
  const title = target ? `Switch to ${target} mode` : "Toggle theme";

  const onClick = () => applyTheme(nextTheme(theme ?? getSnapshot()));

  // `d` toggles from anywhere except text fields and modifier chords.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isPlainKey(event, THEME_KEY)) return;
      event.preventDefault();
      applyTheme(nextTheme(getSnapshot()));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="theme-toggle-rail">
      <button
        type="button"
        className="theme-toggle"
        aria-label="Toggle theme"
        aria-keyshortcuts={THEME_KEY}
        title={title}
        data-target={target ?? undefined}
        onClick={onClick}
      >
        {target === "dark" ? <MoonIcon /> : target === "light" ? <SunIcon /> : null}
      </button>
    </div>
  );
}
