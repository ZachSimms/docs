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
  /** Destination. Internal paths use `next/link`; anything with a scheme or `//` is a plain anchor. */
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

/** Matches absolute (`https://…`) and protocol-relative (`//…`) URLs. */
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;

/**
 * Render `<a><i>label</i></a>`, the `<i>` carrying the dotted underline.
 *
 * Internal hrefs render through `next/link` for client-side navigation;
 * external and `mailto:` hrefs render a plain `<a rel="noopener">`. Any other
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
  if (EXTERNAL.test(href) || /^mailto:/i.test(href)) {
    return (
      <a href={href} rel="noopener" {...shared}>
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
