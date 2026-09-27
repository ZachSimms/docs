/**
 * @file Keeps the current page's entry visible inside the navigation's own scroll box.
 *
 * Client component rendered at the end of `SiteNav`. Deep in a large topic the tree is
 * taller than the window, and the navigation scrolls by itself (it is sticky); on load
 * this centers the `aria-current="page"` entry in that box. It sets `scrollTop` rather
 * than calling `scrollIntoView`, which would scroll the window too.
 */

"use client";

import { useEffect, useRef } from "react";

/** Render an empty marker whose parent `<aside>` is the box to scroll. */
export function NavScroller() {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const box = ref.current?.closest("aside");
    const current = box?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!box || !current || box.scrollHeight <= box.clientHeight) return;
    const offset =
      current.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTop = Math.max(0, offset - box.clientHeight / 2);
  }, []);

  return <span ref={ref} hidden />;
}
