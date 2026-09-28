/**
 * @file Root layout: `<html>`/`<body>`, global CSS, metadata,
 * the inline theme bootstrap script, the fixed theme toggle, the ⌘K palette, the
 * terminal and the touch edge gestures.
 *
 * `suppressHydrationWarning` on `<html>` is required because the inline script
 * may add `data-theme` (and, inside the playground's reference panel,
 * `data-embed`, and `data-zen` for zen mode) before React hydrates.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SearchPalette } from "@/components/SearchPalette";
import { TapNav } from "@/components/TapNav";
import { Terminal } from "@/components/Terminal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";
import { EMBED_INIT_SCRIPT, THEME_INIT_SCRIPT, ZEN_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

/** Default title, `%s - Zach` template for child pages, and site description. */
export const metadata: Metadata = {
  title: { default: SITE_TITLE, template: `%s - ${SITE_TITLE}` },
  description: SITE_DESCRIPTION,
};

/** Root layout; see the file header for what it mounts and why. */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + EMBED_INIT_SCRIPT + ZEN_INIT_SCRIPT }} />
        <ThemeToggle />
        {children}
        <Terminal />
        <SearchPalette />
        <TapNav />
      </body>
    </html>
  );
}
