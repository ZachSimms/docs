/**
 * @file The playground's help: getting started, the current project type, and every shortcut.
 *
 * Client component, a native modal `<dialog>` (so page shortcuts stay quiet
 * while it is open and Esc closes it). Opened by the `?` button, F1 or ⌘/.
 */

"use client";

import { useEffect, useRef } from "react";
import { DottedLink } from "@/components/DottedLink";
import type { LanguageSpec } from "@/lib/playground/languages";
import { PLAYGROUND_SHORTCUTS } from "@/lib/playground/shortcuts";

/** Props for {@link HelpPanel}. */
interface HelpPanelProps {
  open: boolean;
  spec: LanguageSpec;
  onClose(): void;
  /** Start the guided tour (closes the help first). */
  onTour(): void;
}

/** Render the help dialog. */
export function HelpPanel({ open, spec, onClose, onTour }: HelpPanelProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) el.showModal?.();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="pg-help"
      aria-labelledby="pg-help-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose(); // the backdrop
      }}
    >
      <div className="pg-help-body">
        <div className="pg-bar">
          <h2 id="pg-help-title">Playground help</h2>
          <button type="button" className="link" aria-label="Close help" onClick={onClose}>
            <i>✕</i>
          </button>
        </div>

        <section aria-labelledby="pg-help-start">
          <h3 id="pg-help-start">Getting started</h3>
          <ol className="pg-help-steps">
            <li>Pick a project type at the top. Each one starts as a small multi-file example.</li>
            <li>Edit any file; the ▶ file in the tree is the entry that runs first.</li>
            <li>
              Press <kbd>▶ Run</kbd> or <kbd>⌘↵</kbd>. Output and errors appear below the editor.
            </li>
            <li>Right-click the tree to add, rename or delete files and folders.</li>
            <li>Open Refs (⌘K) to search the cheatsheets and official docs beside your code.</li>
          </ol>
          <p>
            <button type="button" className="link" onClick={onTour}>
              <i>take the 1-minute tour</i>
            </button>
          </p>
        </section>

        <section aria-labelledby="pg-help-project">
          <h3 id="pg-help-project">{spec.label}</h3>
          <p>{spec.credit}</p>
          {spec.stdin && (
            <p>This project reads standard input from the stdin box under the output.</p>
          )}
          {spec.download && (
            <p>
              The first run downloads {spec.download.what} (≈ {spec.download.megabytes} MB); later
              runs use the browser&apos;s copy.
            </p>
          )}
          <p>Sheets to start with:</p>
          <ul>
            {spec.refs.map((ref) => (
              <li key={ref.href}>
                <DottedLink href={ref.href}>{ref.label}</DottedLink>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="pg-help-keys">
          <h3 id="pg-help-keys">Shortcuts</h3>
          <table>
            <tbody>
              {PLAYGROUND_SHORTCUTS.map((s) => (
                <tr key={s.keys}>
                  <td>
                    <kbd>{s.keys}</kbd>
                  </td>
                  <td>{s.does}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="pg-help-safety">
          <h3 id="pg-help-safety">Where your code runs</h3>
          <p>
            JavaScript, TypeScript, Python, web pages and GDScript run in sandboxes in your browser
            that can&apos;t reach this site&apos;s data. C++ and Rust are sent to Compiler Explorer
            to compile and run. Projects are saved only in this browser.
          </p>
        </section>
      </div>
    </dialog>
  );
}
