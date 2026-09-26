/**
 * @file The sandboxed frame inside `<Demo>`, kept in step with the site theme.
 *
 * Client component: a `srcdoc` frame follows the OS color scheme rather than
 * the page's, so the document is rebuilt with the active theme's
 * `color-scheme` whenever `useTheme` reports a change (the frame reloads,
 * which is cheap for these small snippets).
 */

"use client";

import { useTheme } from "@/components/useTheme";
import { buildSrcDoc } from "@/lib/demo";

/** Props for {@link DemoFrame}. */
interface DemoFrameProps {
  /** The snippet: HTML with an optional `<style>` block. */
  html: string;
  /** Extra CSS for the document (a Tailwind demo's compiled utilities). */
  css?: string;
  /** Frame height in CSS pixels. */
  height: string;
  /** Accessible name of the frame. */
  title: string;
}

/** `<iframe sandbox="">` showing the snippet in the current theme; scripts never run. */
export function DemoFrame({ html, css, height, title }: DemoFrameProps) {
  const theme = useTheme();
  return (
    <iframe
      sandbox=""
      srcDoc={buildSrcDoc(html, theme, css)}
      title={title}
      height={height}
      loading="lazy"
    />
  );
}
