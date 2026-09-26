/**
 * @file `<TailwindDemo>`: a demo whose classes are real Tailwind utilities.
 *
 * Async server component, rendered by `<Demo tailwind="true">` at build time.
 * `lib/tailwind-demo.ts` compiles just the utilities the snippet uses and the
 * CSS is written into the frame's `srcdoc`, so the frame stays `sandbox=""`
 * with no scripts and no runtime Tailwind.
 */

import { DemoFigure } from "@/components/DemoFigure";
import { compileTailwindDemo } from "@/lib/tailwind-demo";

/** Props for {@link TailwindDemo}. */
interface TailwindDemoProps {
  /** The snippet: markup plus optional `<style>` blocks of Tailwind CSS (`@theme`, `@utility`…). */
  html: string;
  /** Frame height in CSS pixels. */
  height?: string;
  /** The fence title, used in the frame's accessible name. */
  title?: string;
}

/** Compile the snippet's Tailwind CSS and render it in a demo frame. */
export async function TailwindDemo({ html, height, title }: TailwindDemoProps) {
  const { markup, css } = await compileTailwindDemo(html);
  return <DemoFigure html={markup} css={css} height={height} title={title} />;
}
