/**
 * @file The home page's section list: a key and the section's link on each line.
 * Pressing the key (`p`, `r`, `b`, `g`) opens the section.
 *
 * Client component: the keys are listened for on the window, except in text fields,
 * with a modifier held, or while the search palette or a dialog is open.
 */

"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { HOME_KEYS, isOverlayOpen, isPlainKey } from "@/lib/keys";
import { DottedLink } from "./DottedLink";

/** Render `<nav>` with one `key  Section` row per section. */
export function HomeKeys() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (isOverlayOpen()) return;
      const hit = HOME_KEYS.find(({ key }) => isPlainKey(event, key));
      if (!hit) return;
      event.preventDefault();
      router.push(hit.href);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  return (
    <nav className="home-keys" aria-label="Sections">
      {HOME_KEYS.map(({ key, label, href }) => (
        <p key={key}>
          <kbd>{key}</kbd>
          <DottedLink href={href} aria-keyshortcuts={key}>
            {label}
          </DottedLink>
        </p>
      ))}
    </nav>
  );
}
