/**
 * @file The HTML/CSS/JS live preview.
 *
 * Client component. The project is linked (stylesheets inlined, modules turned
 * into `data:` URLs) half a second after typing stops, or at once on Run, and
 * shown in an `<iframe sandbox="allow-scripts allow-forms" srcdoc>`, an opaque origin. Its
 * console output reaches the page only through `acceptFrameMessage` (right
 * frame, current token, valid shape).
 */

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { linkWebDocument, replaceModuleUrls } from "@/lib/playground/module-linker";
import type { Stream } from "@/lib/playground/output";
import type { Project } from "@/lib/playground/project";
import { acceptFrameMessage, newRunToken } from "@/lib/playground/runtime/protocol";
import { buildPreviewSrcDoc } from "@/lib/playground/runtime/web-preview";
import { transpile } from "@/lib/playground/transpile";
import { PREVIEW_SANDBOX_FLAGS } from "./useSandboxFrame";

/** Wait this long after the last keystroke before refreshing. */
export const PREVIEW_DEBOUNCE_MS = 500;

/** Props for {@link WebPreview}. */
interface WebPreviewProps {
  project: Project;
  /** Bump to refresh now (the Run button). */
  refreshKey: number;
  /** A new preview is about to load: clear the console. */
  onReload(): void;
  /** Console output from the page. */
  onOutput(stream: Stream, text: string): void;
  /** A drag handle on the preview's edge. */
  resizer?: ReactNode;
}

/** Render the preview frame. */
export function WebPreview({ project, refreshKey, onReload, onOutput, resizer }: WebPreviewProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const token = useRef<string | null>(null);
  const urls = useRef<ReadonlyMap<string, string>>(new Map());
  const callbacks = useRef({ onReload, onOutput });
  const [doc, setDoc] = useState<string>("");
  const lastRefresh = useRef(refreshKey);

  useEffect(() => {
    callbacks.current = { onReload, onOutput };
  });

  // Rebuild after a pause in typing, or immediately when Run bumps refreshKey.
  useEffect(() => {
    const immediate = refreshKey !== lastRefresh.current;
    lastRefresh.current = refreshKey;
    let canceled = false;
    const handle = setTimeout(
      () => {
        const runToken = newRunToken();
        linkWebDocument(project.files, project.entry, transpile)
          .then(({ html, urls: linked }) => {
            if (canceled) return;
            token.current = runToken;
            urls.current = linked;
            callbacks.current.onReload();
            setDoc(buildPreviewSrcDoc(html, runToken));
          })
          .catch((error: unknown) => {
            if (canceled) return;
            callbacks.current.onReload();
            callbacks.current.onOutput(
              "stderr",
              `${error instanceof Error ? error.message : String(error)}\n`,
            );
          });
      },
      immediate ? 0 : PREVIEW_DEBOUNCE_MS,
    );
    return () => {
      canceled = true;
      clearTimeout(handle);
    };
  }, [project.files, project.entry, refreshKey]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      const message = acceptFrameMessage(event, frame.current?.contentWindow, token.current);
      if (message?.type === "out") {
        callbacks.current.onOutput(message.stream, replaceModuleUrls(message.text, urls.current));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <section className="pg-preview" aria-label="Preview">
      {resizer}
      <div className="pg-bar">
        <span>Preview</span>
        <span className="pg-status">updates as you type</span>
      </div>
      <iframe
        ref={frame}
        sandbox={PREVIEW_SANDBOX_FLAGS}
        srcDoc={doc}
        title={`Preview of ${project.entry}`}
        className="pg-preview-frame"
      />
    </section>
  );
}
