/**
 * @file `press d for light` (or `dark`): the theme shortcut, named for the mode it
 * switches to. Client component; empty until the theme is known after hydration.
 */

"use client";

import { useTheme } from "@/components/useTheme";
import { THEME_KEY } from "@/lib/keys";
import { nextTheme } from "@/lib/theme";

/** Render the hint as a dim line. */
export function ThemeHint() {
  const theme = useTheme();
  return (
    <p className="dim theme-hint" aria-hidden="true">
      {theme && `press ${THEME_KEY} for ${nextTheme(theme)}`}
    </p>
  );
}
