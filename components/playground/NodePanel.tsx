/**
 * @file The Node route's preview: the dev server running in the WebContainer, or why it can't run here.
 *
 * Client component. The preview frame shows StackBlitz's origin
 * (`*.webcontainer-api.io`), never the site's. Browsers that can't run a
 * WebContainer get a way to open the same project on StackBlitz instead (a
 * form posted to a new tab, as StackBlitz's SDK does) and a way back.
 */

"use client";

import { useState, type ReactNode } from "react";
import type { Project } from "@/lib/playground/project";
import { PLAYGROUND_PATH } from "@/lib/reference-panel";
import { STACKBLITZ_RUN, stackblitzFields, type NodeSupport } from "@/lib/playground/webcontainer";

/** Props for {@link NodePanel}. */
interface NodePanelProps {
  support: NodeSupport | "checking";
  url: string | null;
  running: boolean;
  project: Project;
  /** The drag handle on the panel's edge. */
  resizer?: ReactNode;
}

const WHY: Record<Exclude<NodeSupport, null>, string> = {
  ios: "WebContainers don't run on iPhone or iPad (their browsers are all Safari's engine).",
  "not-isolated":
    "This browser can't run WebContainers here: it needs desktop Chrome, Edge or Firefox (Safari isn't supported).",
};

/** Render the panel. */
export function NodePanel({ support, url, running, project, resizer }: NodePanelProps) {
  const [reloads, setReloads] = useState(0);
  if (support !== null && support !== "checking") {
    return (
      <section className="pg-preview pg-node" aria-label="Next.js preview">
        {resizer}
        <div className="pg-bar">
          <span>Next.js</span>
        </div>
        <div className="pg-node-unsupported" role="note">
          <p>{WHY[support]}</p>
          <form action={STACKBLITZ_RUN} method="post" target="_blank" rel="noopener">
            {stackblitzFields(project, "Next.js playground").map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <button type="submit" className="link">
              <i>Open this project on StackBlitz</i>
              <span className="pg-muted"> (sends its files there, except .env files)</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </button>
          </form>
          <p>
            {/* A plain link (a full page load) drops this page's isolation headers. */}
            <a href={PLAYGROUND_PATH}>
              <i>← back to the other projects</i>
            </a>
          </p>
        </div>
      </section>
    );
  }
  return (
    <section className="pg-preview pg-node" aria-label="Next.js preview">
      {resizer}
      <div className="pg-bar">
        <span>Preview</span>
        <span className="pg-status">
          {url ? new URL(url).host : running ? "starting…" : "press Run (⌘↵) to start next dev"}
        </span>
        {url && (
          <span className="pg-bar-actions">
            <button type="button" className="link" onClick={() => setReloads((n) => n + 1)}>
              <i>↻ reload</i>
            </button>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <i>↗ new tab</i>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </span>
        )}
      </div>
      {url ? (
        <iframe
          key={reloads}
          src={url}
          title="Next.js preview"
          className="pg-node-frame"
          // Its own origin (StackBlitz's); it may never navigate the playground.
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          allow="cross-origin-isolated"
        />
      ) : (
        <p className="pg-muted pg-node-idle">
          The first run installs Next.js and its packages (about 200 MB, into memory) and takes
          15–40 seconds. Your files are sent to the WebContainer (StackBlitz) running in this tab.
        </p>
      )}
    </section>
  );
}
