/**
 * @file `<Cards>` / `<Card>`: a list of links with one-line descriptions.
 *
 * Server components. Instead of boxed cards, each entry is a `> title` line
 * (the idiom of the original site's info page) with the description indented
 * beneath it.
 */

import type { ReactNode } from "react";
import { DottedLink } from "./DottedLink";

/** Wrapper: `<nav class="cards">`. Children should be {@link Card}s. */
export function Cards({ children }: { children: ReactNode }) {
  return <nav className="cards">{children}</nav>;
}

/** Props for {@link Card}. */
interface CardProps {
  /** Link text. */
  title: string;
  /** Destination; internal paths use client-side navigation, external URLs a plain anchor. */
  href: string;
  /** Optional one-line description shown under the title. */
  description?: string;
}

/** One entry: `> <link>` followed by the description, if any. */
export function Card({ title, href, description }: CardProps) {
  return (
    <div className="card">
      {">"} <DottedLink href={href}>{title}</DottedLink>
      {description && <p className="card-desc">{description}</p>}
    </div>
  );
}
