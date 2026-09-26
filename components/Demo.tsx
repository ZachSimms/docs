/**
 * @file `<Demo>`: an HTML/CSS snippet rendered live, below its code block.
 *
 * Server component. Authors don't write it by hand: `lib/remark-demo.ts` adds
 * it after every ```` ```html demo ```` fence. The snippet runs in an
 * `<iframe sandbox="">` built from `srcdoc` (see `DemoFrame`), so its
 * selectors can't leak into the page and scripts never run; CSS transitions
 * and animations still do. The document and its base styles come from
 * `lib/demo.ts`. With `tailwind="true"` (```` ```html demo tailwind ````) the
 * snippet's classes are compiled by `<TailwindDemo>` instead.
 */

import { DemoFigure } from "@/components/DemoFigure";
import { TailwindDemo } from "@/components/TailwindDemo";

/** Props for {@link Demo}; strings because they come from fence meta. */
interface DemoProps {
  /** The snippet: HTML with an optional `<style>` block. */
  html: string;
  /** Frame height in CSS pixels. */
  height?: string;
  /** The fence title, used in the frame's accessible name. */
  title?: string;
  /** `"true"` when the fence has the `tailwind` flag. */
  tailwind?: string;
}

/** Render the live result of a demo fence. */
export function Demo({ html, height, title, tailwind }: DemoProps) {
  if (tailwind === "true") return <TailwindDemo html={html} height={height} title={title} />;
  return <DemoFigure html={html} height={height} title={title} />;
}
