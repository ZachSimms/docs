/**
 * @file The console: output, stdin, where the code runs, and the one-time download prompt.
 *
 * Client component. Output is untrusted text and is rendered as React text
 * nodes only. While a run streams, the pane stays scrolled to the bottom unless
 * the reader has scrolled up. Copy puts all output on the clipboard.
 */

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LanguageSpec } from "@/lib/playground/languages";
import { outputText, type Output } from "@/lib/playground/output";
import type { RunPhase } from "./usePlaygroundRun";

/** Props for {@link ConsolePane}. */
interface ConsolePaneProps {
  spec: LanguageSpec;
  output: Output;
  phase: RunPhase;
  status: string;
  stdin: string;
  onStdin(value: string): void;
  onClear(): void;
  /** Set while waiting for the reader to approve a big first download. */
  askDownload: boolean;
  onApproveDownload(): void;
  onCancelDownload(): void;
  /** A first-visit welcome card shown above the output, if any. */
  welcome?: ReactNode;
}

/** Whether the browser asked to save data (Chrome's `navigator.connection.saveData`). */
function wantsToSaveData(): boolean {
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return connection?.saveData === true;
}

/** Render the console pane. */
export function ConsolePane(props: ConsolePaneProps) {
  const {
    spec,
    output,
    phase,
    status,
    stdin,
    onStdin,
    onClear,
    askDownload,
    onApproveDownload,
    onCancelDownload,
    welcome,
  } = props;
  const pre = useRef<HTMLPreElement>(null);
  const pinned = useRef(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const el = pre.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [output]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(outputText(output));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="pg-console" aria-label="Output">
      <div className="pg-bar">
        <span>Output</span>
        <span className="pg-status" role="status" aria-live="polite">
          {status}
        </span>
        <span className="pg-bar-actions">
          <button
            type="button"
            className="link"
            onClick={copy}
            disabled={output.chunks.length === 0}
          >
            <i>{copied ? "copied" : "copy"}</i>
          </button>
          <button
            type="button"
            className="link"
            onClick={onClear}
            disabled={output.chunks.length === 0}
          >
            <i>clear</i>
          </button>
        </span>
      </div>
      {welcome}
      {askDownload && spec.download && (
        <div className="pg-download" role="group" aria-label="Download needed">
          <p>
            The first run downloads {spec.download.what} (≈ {spec.download.megabytes} MB); later
            runs use the browser&apos;s copy.
            {wantsToSaveData() && " Your browser asked to save data."}
          </p>
          <p>
            <button type="button" className="link" onClick={onApproveDownload}>
              <i>download and run</i>
            </button>
            {"  "}
            <button type="button" className="link" onClick={onCancelDownload}>
              <i>cancel</i>
            </button>
          </p>
        </div>
      )}
      <pre
        ref={pre}
        className="pg-output"
        tabIndex={0}
        aria-label="Program output"
        data-phase={phase}
        onScroll={(event) => {
          const el = event.currentTarget;
          pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
        }}
      >
        {output.chunks.length === 0 && phase === "idle" && (
          <span className="pg-info">Press Run (⌘↵) to run the entry file.</span>
        )}
        {output.chunks.map((chunk, i) => (
          <span key={i} className={`pg-${chunk.stream}`}>
            {chunk.text}
          </span>
        ))}
        {output.truncated && <span className="pg-info">{"\n"}… output truncated</span>}
      </pre>
      {spec.stdin && (
        <label className="pg-stdin">
          <span>stdin</span>
          <textarea
            value={stdin}
            rows={2}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="Input your program reads (one value per line)"
            onChange={(event) => onStdin(event.target.value)}
          />
        </label>
      )}
      <p className="pg-credit">{spec.credit}</p>
    </section>
  );
}
