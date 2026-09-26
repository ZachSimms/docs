/**
 * @file Intellisense for the playground's editor: which files get it, and keeping the service in sync.
 *
 * Client-only. Nothing downloads until the editor is first focused; then JS/TS
 * files of JS/TS project types get the TypeScript service, which mirrors the
 * project's files (debounced) so imports across files resolve.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { Extension } from "@codemirror/state";
import type { LanguageId } from "@/lib/playground/languages";
import {
  isTsServicePath,
  serviceFiles,
  usesBunTypes,
  usesTsService,
} from "@/lib/playground/intellisense/ts-config";

/** Wait after the last edit before mirroring the project. */
const SYNC_DELAY_MS = 300;

/** What the editor needs. */
export interface Intellisense {
  /** Extensions for a file (empty until armed, or for files nothing covers). */
  loadAssist(path: string): Promise<Extension>;
  /** Call when the editor gains focus. */
  arm(): void;
}

/**
 * Intellisense for the current project.
 *
 * @param language - The project type.
 * @param files - The project's files.
 * @param open - The open file.
 */
export function useIntellisense(
  language: LanguageId,
  files: Readonly<Record<string, string>>,
  open: string,
): Intellisense {
  const [armed, setArmed] = useState(false);
  const ts = armed && usesTsService(language);
  const bun = usesBunTypes(language);

  const loadAssist = useCallback(
    async (path: string): Promise<Extension> => {
      if (!ts || !isTsServicePath(path)) return [];
      const { tsExtensions, tsService } = await import("./typescript");
      try {
        return tsExtensions(await tsService(bun), path);
      } catch {
        // The service failed to start (old browser, offline): plain editing still works.
        return [];
      }
    },
    [ts, bun],
  );

  // Mirror the project once a script is open.
  const active = ts && isTsServicePath(open);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      void import("./typescript")
        .then(({ tsService }) => tsService(bun))
        .then((service) => service.remote.syncFiles(serviceFiles(files)))
        .catch(() => undefined);
    }, SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active, bun, files]);

  const arm = useCallback(() => setArmed(true), []);
  return { loadAssist, arm };
}
