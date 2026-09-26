/**
 * @file The site's single link idiom.
 *
 * The original design underlines links with a dotted rule carried by an inner
 * `<i>`, so every link on the site (navigation, footer, MDX body) goes through
 * this component to get identical markup and styling.
 */

import Link from "next/link";
import type { AnchorHTMLAttributes, ReactNode, Ref } from "react";

/** Props for {@link DottedLink}: `href` plus any standard anchor attribute. */
interface DottedLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  /** Destination. Internal paths use `next/link`; anything with a scheme or `//` opens in a new tab. */
  href: string;
  /** Link text; rendered inside the underlined `<i>`. */
  children: ReactNode;
  /** Body-text links: no extra padding/margin (matches `a.inline` in the original CSS). */
  inline?: boolean;
  /** For terse labels like `v` or `../` that need a description for screen readers. */
  ariaLabel?: string;
  /** The rendered anchor (React 19 passes `ref` as a prop). */
  ref?: Ref<HTMLAnchorElement>;
}

/** Screen-reader note on links that open in a new tab. */
const NEW_TAB_HINT = "(opens in a new tab)";

/** Matches absolute (`https://…`) and protocol-relative (`//…`) URLs. */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

/**
 * Render `<a><i>label</i></a>`, the `<i>` carrying the dotted underline.
 *
 * Internal hrefs render through `next/link` for client-side navigation.
 * Links to other sites (references, docs) open in a new tab:
 * `target="_blank" rel="noopener noreferrer"`, plus a visually hidden
 * "(opens in a new tab)" so screen readers announce it. `mailto:` renders a
 * plain `<a>` in the same tab. Any other
 * anchor attribute (`id`, `aria-*`, `data-*`, `rel`, `target`, …) is forwarded,
 * so generated markup such as GFM footnote references keeps its ids and labels.
 * A caller-supplied `className` is merged with the `inline` class.
 */
export function DottedLink({
  href,
  children,
  inline = false,
  ariaLabel,
  className,
  ...rest
}: DottedLinkProps) {
  const classes = [inline ? "inline" : undefined, className].filter(Boolean).join(" ") || undefined;
  const shared = { className: classes, "aria-label": ariaLabel, ...rest };
  if (EXTERNAL.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...shared}>
        <i>{children}</i>
        <span className="sr-only"> {NEW_TAB_HINT}</span>
      </a>
    );
  }
  if (/^mailto:/i.test(href)) {
    return (
      <a href={href} {...shared}>
        <i>{children}</i>
      </a>
    );
  }
  return (
    <Link href={href} {...shared}>
      <i>{children}</i>
    </Link>
  );
}
