/**
 * @file `<Diagram>`: a site SVG diagram, inlined so it follows the theme.
 *
 * Server component. The SVG is read at build time by `lib/diagram.ts` (only
 * files under `public/images/diagrams/`, and never markup that runs code) and
 * inlined, so strokes and text use `currentColor` and accents use the `.d-*`
 * classes from `app/globals.css` (`--graph-0` … `--graph-3`, `--chip`).
 *
 * @example
 * <Diagram src="/images/diagrams/box-model.svg" label="Content inside padding, border and margin" caption="The box model" />
 */

import { readDiagram } from "@/lib/diagram";

/** Props for {@link Diagram}. */
interface DiagramProps {
  /** URL path of the SVG, e.g. `/images/diagrams/box-model.svg`. */
  src: string;
  /** What the diagram shows, for screen readers. */
  label: string;
  /** Optional caption under the diagram. */
  caption?: string;
}

/** Render `figure.diagram > [role=img] + figcaption?`. */
export function Diagram({ src, label, caption }: DiagramProps) {
  return (
    <figure className="diagram">
      <div role="img" aria-label={label} dangerouslySetInnerHTML={{ __html: readDiagram(src) }} />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
