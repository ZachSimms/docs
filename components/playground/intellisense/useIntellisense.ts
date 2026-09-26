/**
 * @file Intellisense for the playground's editor: which files get it, and keeping the service in sync.
 *
 * Client-only. Nothing downloads until the editor is first focused; then JS/TS
 * files of JS/TS project types get the TypeScript service, and Python files
 * get basedpyright. Both mirror the project's files (debounced) so imports
 * across files resolve. C++, Rust, GDScript, HTML and CSS files get docs
 * hovers from DevDocs.
 */

"use client";

import { useCallback, useEffect, useState } from "react";
import type { Extension } from "@codemirror/state";
import type { LanguageId } from "@/lib/playground/languages";
import { isPythonPath } from "@/lib/playground/intellisense/pyright-config";
import { hoverLanguageFor } from "@/lib/playground/hover-docs";
import { modeForPath } from "@/lib/playground/languages";
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
  const python = armed && language === "python";
  const bun = usesBunTypes(language);

  const loadAssist = useCallback(
    async (path: string): Promise<Extension> => {
      try {
        if (ts && isTsServicePath(path)) {
          const { tsExtensions, tsService } = await import("./typescript");
          return tsExtensions(await tsService(bun), path);
        }
        if (python && isPythonPath(path)) {
          const { pythonExtensions, pythonService } = await import("./python");
          return pythonExtensions(await pythonService(), path);
        }
        const hoverLang = armed ? hoverLanguageFor(modeForPath(path)) : null;
        if (hoverLang) {
          const { docsHoverExtensions, loadHoverDocs } = await import("./docs-hover");
          return docsHoverExtensions(await loadHoverDocs(hoverLang));
        }
      } catch {
        // The service failed to start (old browser, offline): plain editing still works.
      }
      return [];
    },
    [armed, ts, python, bun],
  );

  // Mirror the project once a file the service covers is open.
  const service =
    ts && isTsServicePath(open) ? "ts" : python && isPythonPath(open) ? "python" : null;
  useEffect(() => {
    if (!service) return;
    const timer = setTimeout(() => {
      const sync =
        service === "ts"
          ? import("./typescript")
              .then(({ tsService }) => tsService(bun))
              .then((s) => s.remote.syncFiles(serviceFiles(files)))
          : import("./python")
              .then(({ pythonService }) => pythonService())
              .then((s) => s.workspace.setProject(files));
      sync.catch(() => undefined);
    }, SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [service, bun, files]);

  const arm = useCallback(() => setArmed(true), []);
  return { loadAssist, arm };
}
