/**
 * @file The Markdown preview beside the editor.
 *
 * Client component. Renders with `lib/playground/markdown.ts` into an
 * `<iframe sandbox="">`: no scripts at all, and links stay inert (a
 * `<base target="_blank">` sends them to popups, which the sandbox blocks).
 * Follows the site theme.
 */

"use client";

import { useDeferredValue } from "react";
import { useTheme } from "@/components/useTheme";
import { buildMarkdownSrcDoc } from "@/lib/playground/markdown";

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
  return (
    <section className="pg-md-preview" aria-label={`Preview of ${path}`}>
      <iframe
        sandbox=""
        srcDoc={buildMarkdownSrcDoc(deferred, theme)}
        title={`Preview of ${path}`}
      />
    </section>
  );
}
