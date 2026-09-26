/**
 * @file `/playground/`: the in-browser IDE (see `components/playground/Playground.tsx`).
 *
 * A static route, so it wins over `app/[topic]`. The viewport asks Chrome on
 * Android to resize the layout above the on-screen keyboard
 * (`interactive-widget=resizes-content`); iOS is handled with `visualViewport`
 * in the page itself. Pinch zoom stays enabled.
 */
import type { Metadata, Viewport } from "next";
import { PlaygroundLoader } from "@/components/playground/PlaygroundLoader";
import "./playground.css";

/** Page title and description. */
export const metadata: Metadata = {
  title: "Playground",
  description:
    "Write and run C++, Rust, Python, JavaScript, TypeScript, HTML/CSS and GDScript projects in the browser, with the reference sheets beside the code.",
};

/** Keyboard-aware viewport for phones. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

/** The playground page. */
export default function PlaygroundPage() {
  return <PlaygroundLoader />;
}
