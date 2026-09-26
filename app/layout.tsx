/**
 * @file Root layout: `<html>`/`<body>`, global CSS (site + KaTeX), metadata,
 * the inline theme bootstrap script, the fixed theme toggle, the ⌘K palette and
 * the touch edge gestures.
 *
 * `suppressHydrationWarning` on `<html>` is required because the inline script
 * may add `data-theme` (and, inside the playground's reference panel,
 * `data-embed`) before React hydrates.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SearchPalette } from "@/components/SearchPalette";
import { TapNav } from "@/components/TapNav";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";
import { EMBED_INIT_SCRIPT, THEME_INIT_SCRIPT } from "@/lib/theme";
import "katex/dist/katex.min.css";
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
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT + EMBED_INIT_SCRIPT }} />
        <ThemeToggle />
        {children}
        <SearchPalette />
        <TapNav />
      </body>
    </html>
  );
}
