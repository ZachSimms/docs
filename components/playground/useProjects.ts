/**
 * @file The current language's project, persisted per language.
 *
 * Client hook. Edits are saved to `localStorage` 400 ms after they stop, and
 * flushed right away when the page is hidden or unloaded (mobile browsers
 * discard background tabs without warning). A failed save (quota, private
 * mode) is reported so the UI can say so; nothing throws.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LanguageId } from "@/lib/playground/languages";
import type { Project } from "@/lib/playground/project";
import { loadProject, saveProject } from "@/lib/playground/storage";

/** Delay between the last edit and the save. */
export const SAVE_DEBOUNCE_MS = 400;

/** What {@link useProjects} returns. */
export interface ProjectsState {
  project: Project;
  /** Replace the current language's project. */
  setProject(next: Project | ((current: Project) => Project)): void;
  /** Whether the last save failed. */
  saveFailed: boolean;
}

/**
 * Hold the project for `language`, loading it on first use and saving edits.
 *
 * @param language - The language shown.
 */
export function useProjects(language: LanguageId): ProjectsState {
  const [projects, setProjects] = useState<Partial<Record<LanguageId, Project>>>(() => ({
    [language]: loadProject(language),
  }));
  const [saveFailed, setSaveFailed] = useState(false);
  const dirty = useRef(new Set<LanguageId>());
  const latest = useRef(projects);

  useEffect(() => {
    latest.current = projects;
  });

  // Load a language's project the first time it is shown (state adjusted while rendering).
  const loaded = projects[language];
  if (!loaded)
    setProjects((current) =>
      current[language] ? current : { ...current, [language]: loadProject(language) },
    );
  const project = loaded ?? loadProject(language);

  const flush = useCallback(() => {
    let ok = true;
    for (const id of dirty.current) {
      const p = latest.current[id];
      if (p) ok = saveProject(id, p) && ok;
    }
    dirty.current.clear();
    setSaveFailed(!ok);
  }, []);

  // Debounced save after edits.
  useEffect(() => {
    if (dirty.current.size === 0) return;
    const handle = setTimeout(flush, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [projects, flush]);

  // Save on unmount too: client-side navigation (the `../` link) fires neither event below.
  useEffect(() => flush, [flush]);

  // Save now when the page goes away.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, [flush]);

  const setProject = useCallback(
    (next: Project | ((current: Project) => Project)) => {
      // Marked before the (pure) updater runs; saving an unchanged project is harmless.
      dirty.current.add(language);
      setProjects((current) => {
        const base = current[language] ?? loadProject(language);
        const value = typeof next === "function" ? next(base) : next;
        return value === base ? current : { ...current, [language]: value };
      });
    },
    [language],
  );

  return { project, setProject, saveFailed };
}
