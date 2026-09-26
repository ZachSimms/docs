/**
 * @file `figure.demo`: the "Result" caption and the live frame, shared by
 * `<Demo>` (plain CSS snippets) and `<TailwindDemo>` (compiled Tailwind).
 */

import { DemoFrame } from "@/components/DemoFrame";
import { DEFAULT_DEMO_HEIGHT } from "@/lib/demo";

/** Props for {@link DemoFigure}. */
interface DemoFigureProps {
  /** The markup the frame renders. */
  html: string;
  /** Extra CSS for the frame document (compiled utilities), if any. */
  css?: string;
  /** Frame height in CSS pixels, as written in the fence meta. */
  height?: string;
  /** The fence title, used in the frame's accessible name. */
  title?: string;
}

/** Render `figure.demo > figcaption + iframe[sandbox]`. */
export function DemoFigure({ html, css, height, title }: DemoFigureProps) {
  return (
    <figure className="demo">
      <figcaption>Result</figcaption>
      <DemoFrame
        html={html}
        css={css}
        height={height ?? String(DEFAULT_DEMO_HEIGHT)}
        title={title ? `Live demo: ${title}` : "Live demo"}
      />
    </figure>
  );
}
