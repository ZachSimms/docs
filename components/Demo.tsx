/**
 * @file `<Demo>`: an HTML/CSS snippet rendered live, below its code block.
 *
 * Server component. Authors don't write it by hand: `lib/remark-demo.ts` adds
 * it after every ```` ```html demo ```` fence. The snippet runs in an
 * `<iframe sandbox="">` built from `srcdoc` (see `DemoFrame`), so its
 * selectors can't leak into the page and scripts never run; CSS transitions
 * and animations still do. The document and its base styles come from
 * `lib/demo.ts`.
 */

import { DemoFrame } from "@/components/DemoFrame";
import { DEFAULT_DEMO_HEIGHT } from "@/lib/demo";

/** Props for {@link Demo}; strings because they come from fence meta. */
interface DemoProps {
  /** The snippet: HTML with an optional `<style>` block. */
  html: string;
  /** Frame height in CSS pixels. */
  height?: string;
  /** The fence title, used in the frame's accessible name. */
  title?: string;
}

/** Render `figure.demo > figcaption + iframe[sandbox]`. */
export function Demo({ html, height, title }: DemoProps) {
  return (
    <figure className="demo">
      <figcaption>Result</figcaption>
      <DemoFrame
        html={html}
        height={height ?? String(DEFAULT_DEMO_HEIGHT)}
        title={title ? `Live demo: ${title}` : "Live demo"}
      />
    </figure>
  );
}
