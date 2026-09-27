/**
 * @file The home page's section list: a key, the section's link and a line about it.
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

/** Props for {@link HomeKeys}: a short note per section, by its key. */
interface HomeKeysProps {
  readonly notes: Readonly<Record<(typeof HOME_KEYS)[number]["key"], string>>;
}

/** Render `<nav>` with one `key  Section  note` row per section. */
export function HomeKeys({ notes }: HomeKeysProps) {
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
          <span className="dim">{notes[key]}</span>
        </p>
      ))}
    </nav>
  );
}
