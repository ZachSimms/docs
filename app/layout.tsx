/**
 * @file Root layout: `<html>`/`<body>`, global CSS (site + KaTeX), metadata,
 * the inline theme bootstrap script, the fixed theme toggle and the ⌘K palette.
 *
 * `suppressHydrationWarning` on `<html>` is required because the inline script
 * may add `data-theme` before React hydrates.
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SearchPalette } from "@/components/SearchPalette";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SITE_DESCRIPTION, SITE_TITLE } from "@/lib/site";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
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
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeToggle />
        {children}
        <SearchPalette />
      </body>
    </html>
  );
}
