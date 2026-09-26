/**
 * @file Loads the playground in the browser only.
 *
 * Client component: `next/dynamic` with `ssr: false` must live in a client
 * component. The playground's state comes from `localStorage`, so rendering it
 * on the server would only produce a flash of the starter project. The editor
 * and runners also stay out of every other page's bundle this way.
 */

"use client";

import dynamic from "next/dynamic";

const Playground = dynamic(() => import("./Playground").then((m) => m.Playground), {
  ssr: false,
  loading: () => <p className="pg-loading">Loading the playground…</p>,
});

/** The playground, client-side only; `route="node"` on the WebContainer page. */
export function PlaygroundLoader({ route = "main" }: { route?: "main" | "node" }) {
  return <Playground route={route} />;
}
