/**
 * @file `<Callout>`: Fumadocs-style callout built on {@link Note}.
 *
 * `type` maps to a label (`info` → "note", `warn` → "warning", `error` → "error");
 * warning and error callouts get a solid instead of dotted left rule in CSS.
 * No colours, keeping the monochrome look.
 */

import type { ReactNode } from "react";
import { Note } from "./Note";

/** Supported callout types, matching Fumadocs' names. */
export type CalloutType = "info" | "warn" | "error";

/** Label printed for each type. */
export const CALLOUT_KIND: Record<CalloutType, string> = {
  info: "note",
  warn: "warning",
  error: "error",
};

/** Props for {@link Callout}. */
interface CalloutProps {
  /** Severity; defaults to `info`. */
  type?: CalloutType;
  /** Optional bold heading line. */
  title?: string;
  children: ReactNode;
}

/** Render a callout as a {@link Note} with the type's label and an optional title. */
export function Callout({ type = "info", title, children }: CalloutProps) {
  return (
    <Note kind={CALLOUT_KIND[type]} title={title}>
      {children}
    </Note>
  );
}
