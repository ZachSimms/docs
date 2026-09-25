/**
 * @file `<Steps>` / `<Step>`: a numbered procedure.
 *
 * Server components. Numbering is done with CSS counters
 * (`01.`, `02.`, …) so it matches the site's zero-padded lists.
 */

import type { ReactNode } from "react";

/** Wrapper: `<ol class="steps">`. Children should be {@link Step}s. */
export function Steps({ children }: { children: ReactNode }) {
  return <ol className="steps">{children}</ol>;
}

/** Props for {@link Step}. */
interface StepProps {
  /** Optional bold title on the step's first line. */
  title?: string;
  /** Step body; Markdown paragraphs, lists and code all work. */
  children?: ReactNode;
}

/** One step. Renders `<li>` with the optional title in bold on its own line. */
export function Step({ title, children }: StepProps) {
  return (
    <li>
      {title && (
        <p className="step-title">
          <b>{title}</b>
        </p>
      )}
      {children}
    </li>
  );
}
