/**
 * @file `/playground/node/`: the playground for Node projects (Next.js), running in a WebContainer.
 *
 * The same playground, on its own page: only this route is served
 * cross-origin isolated (COOP `same-origin`, COEP `credentialless`, see
 * `next.config.ts`), which WebContainer needs and the other runners'
 * third-party scripts would not survive. The project picker moves between the
 * two pages with full page loads.
 */
import type { Metadata, Viewport } from "next";
import { PlaygroundLoader } from "@/components/playground/PlaygroundLoader";
import "../playground.css";

/** Page title and description. */
export const metadata: Metadata = {
  title: "Next.js playground",
  description:
    "Edit and run a Next.js App Router project with a real next dev, in a WebContainer in your browser.",
};

/** Keyboard-aware viewport for phones (as on `/playground/`). */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

/** The Node playground page. */
export default function NodePlaygroundPage() {
  return <PlaygroundLoader route="node" />;
}
