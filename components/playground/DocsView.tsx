/**
 * @file One official docs page in the reference panel.
 *
 * Client component. Fetches the page from DevDocs, sanitizes it with
 * DOMPurify and shows it in `<iframe sandbox="allow-same-origin" srcdoc>`:
 * no scripts can run (no `allow-scripts`, plus a `default-src 'none'` CSP),
 * and same-origin only lets this page catch link clicks, so links inside the
 * docset open here, anchors scroll, and other links open in a new tab.
 */

"use client";

import createDOMPurify from "dompurify";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/useTheme";
import {
  buildDocSrcDoc,
  officialUrl,
  pageUrl,
  resolveDocLink,
  splitFragment,
  type Docset,
} from "@/lib/playground/docs";
import { Spinner } from "./Spinner";

/** A fragment as an element id (`%40` → `@`); malformed escapes are used as written. */
function decodeFragment(fragment: string): string {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

/** Props for {@link DocsView}. */
interface DocsViewProps {
  set: Docset;
  path: string;
  name: string;
  /** Show another page of the same docset. */
  onNavigate(path: string, name: string): void;
}

/** A fetched page (or its failure), for the URL it came from; any other URL is still loading. */
type Load =
  | { url: string; status: "ready"; html: string }
  | { url: string; status: "error"; message: string };

/** Render the page. */
export function DocsView({ set, path, name, onNavigate }: DocsViewProps) {
  const [loaded, setLoaded] = useState<Load | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const theme = useTheme();
  const official = officialUrl(set, { name, path });

  useEffect(() => {
    const controller = new AbortController();
    const url = pageUrl(set, path);
    fetch(url, {
      signal: controller.signal,
      credentials: "omit",
      referrerPolicy: "no-referrer",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.text();
      })
      .then((html) => setLoaded({ url, status: "ready", html }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setLoaded({
          url,
          status: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      });
    return () => controller.abort();
  }, [set, path]);

  const load = loaded?.url === pageUrl(set, path) ? loaded : null;

  // Build the frame document; refuse to show anything if the sanitizer can't run here.
  let srcDoc: string | null = null;
  let problem: string | null =
    load?.status === "error" ? `Docs unavailable (${load.message}).` : null;
  if (load?.status === "ready") {
    const purify = createDOMPurify(window);
    if (purify.isSupported) {
      srcDoc = buildDocSrcDoc(
        load.html,
        set,
        path,
        (dirty, config) => purify.sanitize(dirty, config) as string,
        theme,
      );
    } else problem = "This browser can't show docs pages safely here.";
  }

  // The click handler outlives renders (it's added once per load): read the latest props.
  const latest = useRef({ path, onNavigate });
  useEffect(() => {
    latest.current = { path, onNavigate };
  });

  /** Scroll to the path's `#fragment`, if the page has it. */
  const scrollToFragment = (doc: Document, target: string) => {
    const fragment = splitFragment(target).fragment;
    if (fragment) doc.getElementById(decodeFragment(fragment))?.scrollIntoView();
  };

  // Another member of the same page: the frame document is unchanged (no load event), so scroll here.
  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (doc?.readyState === "complete") scrollToFragment(doc, path);
  }, [path]);

  /** Scroll to the fragment and catch clicks inside the page once it has loaded. */
  const onLoad = () => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    scrollToFragment(doc, latest.current.path);
    doc.addEventListener("click", (event) => {
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!link) return;
      event.preventDefault();
      const { path: current, onNavigate: navigate } = latest.current;
      const target = resolveDocLink(set.slug, current, link.getAttribute("href") ?? "");
      if (target.kind === "anchor")
        doc.getElementById(decodeFragment(target.fragment))?.scrollIntoView();
      else if (target.kind === "page")
        navigate(target.path, link.textContent?.trim() || target.path);
      else window.open(target.url, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <div className="pg-docs-view">
      <div className="pg-bar">
        <span className="pg-docs-title" title={name}>
          {name}
        </span>
        {official && (
          <a href={official} target="_blank" rel="noopener noreferrer">
            <i>↗ official</i>
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        )}
      </div>
      {problem ? (
        <p className="pg-docs-problem" role="alert">
          {problem}{" "}
          {official && (
            <a href={official} target="_blank" rel="noopener noreferrer">
              <i>open it on the official site</i>
            </a>
          )}
        </p>
      ) : srcDoc === null ? (
        <p className="pg-muted pg-docs-problem" role="status">
          <Spinner />
          loading…
        </p>
      ) : (
        <iframe
          ref={frame}
          sandbox="allow-same-origin"
          srcDoc={srcDoc}
          title={`${set.name}: ${name}`}
          className="pg-docs-frame"
          onLoad={onLoad}
        />
      )}
    </div>
  );
}
