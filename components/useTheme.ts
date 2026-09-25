/**
 * @file The site theme as client state: `useTheme`, `currentTheme` and `applyTheme`.
 *
 * Client-only module shared by the theme toggle and anything that must follow
 * the theme from script (the live demo frames, whose documents don't inherit
 * the page's `color-scheme`). The rules for resolving a theme live in
 * `lib/theme.ts`.
 */

"use client";

import { useSyncExternalStore } from "react";
import { STORAGE_KEY, THEME_ATTRIBUTE, resolveTheme, type Theme } from "@/lib/theme";

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

/** The theme currently in effect (client only): the stored choice, else the OS preference. */
export function currentTheme(): Theme {
  return resolveTheme(readStored(), prefersDark());
}

/** Server snapshot: unknown, so SSR and the first client render agree. */
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

/**
 * The active theme, re-rendering when it changes (toggle, `d`, another tab or
 * the OS preference).
 *
 * @returns `null` during SSR and hydration, then `"light"` or `"dark"`.
 */
export function useTheme(): Theme | null {
  return useSyncExternalStore(subscribe, currentTheme, getServerSnapshot);
}
