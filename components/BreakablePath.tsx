/**
 * @file `<BreakablePath>`: a `topic/dir/sheet` label that may wrap at its slashes.
 *
 * Server-safe (no hooks). Used by the numbered lists and the search results,
 * where the label sits after an `NN.` number on the same line.
 */

import { Fragment } from "react";
import { pathSegments } from "@/lib/format";

/** Render `label` with a `<wbr>` after every `/` (adds no text, so copying is unchanged). */
export function BreakablePath({ label }: { label: string }) {
  return pathSegments(label).map((segment, i) => (
    <Fragment key={i}>
      {i > 0 && <wbr />}
      {segment}
    </Fragment>
  ));
}
