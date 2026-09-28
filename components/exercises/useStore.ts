/**
 * @file State kept in `localStorage`: read once on mount, written (debounced) on change.
 *
 * Client hook. The exercise pages render client-only, so the initial read happens in the
 * state initializer without a hydration mismatch. Writes wait 300 ms (typing in the editor
 * changes the store on every keystroke) and are flushed when the page is hidden or the
 * component unmounts, so the last edits aren't lost.
 */

"use client";

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import type { z } from "zod";
import { loadStore, saveStore } from "@/lib/exercises/storage";

/** Delay before a change is written. */
const SAVE_DELAY_MS = 300;

/**
 * Keep `T` in `localStorage` under `key`.
 *
 * @returns The value and its setter, like `useState`.
 */
export function useStore<T>(
  key: string,
  schema: z.ZodType<T>,
  empty: T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => loadStore(key, schema, empty));
  const latest = useRef(value);
  const dirty = useRef(false);

  useEffect(() => {
    latest.current = value;
    dirty.current = true;
    const timer = setTimeout(() => {
      saveStore(key, value);
      dirty.current = false;
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [key, value]);

  useEffect(() => {
    const flush = () => {
      if (!dirty.current) return;
      saveStore(key, latest.current);
      dirty.current = false;
    };
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [key]);

  return [value, setValue];
}
