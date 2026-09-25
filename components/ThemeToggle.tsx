/**
 * @file Light/dark theme switch.
 *
 * Client component. Reads the active theme through `useTheme` (localStorage
 * and the OS preference), writes the user's choice back with `applyTheme`, and renders a monochrome sun or
 * moon pinned to the top of the viewport. Pressing `d` anywhere (outside a
 * text field) toggles too. The rules live in `lib/theme.ts`.
 */

"use client";

import { useEffect } from "react";
import { applyTheme, currentTheme, useTheme } from "@/components/useTheme";
import { THEME_KEY, isPlainKey } from "@/lib/keys";
import { nextTheme } from "@/lib/theme";

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
  const theme = useTheme();
  const target = theme === null ? null : nextTheme(theme);
  const title = target ? `Switch to ${target} mode` : "Toggle theme";

  const onClick = () => applyTheme(nextTheme(theme ?? currentTheme()));

  // `d` toggles from anywhere except text fields and modifier chords.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!isPlainKey(event, THEME_KEY)) return;
      event.preventDefault();
      applyTheme(nextTheme(currentTheme()));
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
