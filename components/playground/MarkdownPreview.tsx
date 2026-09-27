/**
 * @file The Markdown preview beside the editor.
 *
 * Client component. Renders with `lib/playground/markdown.ts` into an
 * `<iframe sandbox="">`: no scripts at all, and links stay inert (a
 * `<base target="_blank">` sends them to popups, which the sandbox blocks).
 * Follows the site theme.
 */

"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useTheme } from "@/components/useTheme";

/** The renderer (micromark + GFM, ~30 KB gzipped), loaded with the first Markdown preview. */
type Render = typeof import("@/lib/playground/markdown").buildMarkdownSrcDoc;
let renderer: Promise<Render> | undefined;
const loadRenderer = () =>
  (renderer ??= import("@/lib/playground/markdown").then((m) => m.buildMarkdownSrcDoc));

/** Props for {@link MarkdownPreview}. */
interface MarkdownPreviewProps {
  /** The Markdown source. */
  source: string;
  /** The file's path, for the frame's accessible name. */
  path: string;
}

/** Render the preview frame. */
export function MarkdownPreview({ source, path }: MarkdownPreviewProps) {
  const theme = useTheme();
  // Typing stays responsive in long documents: the preview may lag a keystroke behind.
  const deferred = useDeferredValue(source);
  const [render, setRender] = useState<Render | null>(null);
  useEffect(() => {
    let live = true;
    void loadRenderer().then((r) => live && setRender(() => r));
    return () => {
      live = false;
    };
  }, []);
  // Rendered only when the text or theme changes, not on every playground update (output, …).
  const doc = useMemo(() => (render ? render(deferred, theme) : ""), [render, deferred, theme]);
  return (
    <section className="pg-md-preview" aria-label={`Preview of ${path}`}>
      <iframe sandbox="" srcDoc={doc} title={`Preview of ${path}`} />
    </section>
  );
}
