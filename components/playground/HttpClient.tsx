/**
 * @file The HTTP panel for server projects (Bun, Bun + Hono).
 *
 * Client component. Method, path, headers and body become a request for the
 * emulated server inside the sandbox (nothing goes over the network). The
 * response shows status, time, headers and body (JSON pretty-printed); an
 * HTML response can be previewed in an `<iframe sandbox="">`.
 */

"use client";

import { useState, type ReactNode } from "react";
import type { HttpPreset } from "@/lib/playground/languages";
import {
  buildHttpRequest,
  formatBody,
  HTTP_METHODS,
  type HttpDraft,
  type HttpMethod,
  type HttpRequestMessage,
  type HttpResult,
} from "@/lib/playground/http";

/** Props for {@link HttpClient}. */
interface HttpClientProps {
  /** The port the server listens on, or `null` when it isn't running. */
  port: number | null;
  presets: readonly HttpPreset[];
  send(message: Omit<HttpRequestMessage, "id">): Promise<HttpResult>;
  /** A drag handle on the panel's edge. */
  resizer?: ReactNode;
}

/** One sent request and its result, for the history. */
interface Exchange {
  readonly draft: HttpDraft;
  readonly result: HttpResult;
}

/** Most exchanges kept in the history. */
const HISTORY = 10;

/** Render the panel. */
export function HttpClient({ port, presets, send, resizer }: HttpClientProps) {
  const first = presets[0];
  const [draft, setDraft] = useState<HttpDraft>({
    method: first?.method ?? "GET",
    path: first?.path ?? "/",
    headers: "",
    body: first?.body ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [history, setHistory] = useState<readonly Exchange[]>([]);
  const [asHtml, setAsHtml] = useState(false);
  const latest = history[0];

  const submit = async (next: HttpDraft = draft) => {
    if (port === null) return setProblem("Press ▶ Run to start the server first.");
    const message = buildHttpRequest(next, port, "pending");
    if ("error" in message) return setProblem(message.error);
    setProblem(null);
    setBusy(true);
    const { id: _id, ...request } = message;
    void _id;
    const result = await send(request);
    setBusy(false);
    setHistory((current) => [{ draft: next, result }, ...current].slice(0, HISTORY));
  };

  const choosePreset = (preset: HttpPreset) => {
    const next = { method: preset.method, path: preset.path, headers: "", body: preset.body ?? "" };
    setDraft(next);
    void submit(next);
  };

  const type = latest?.result.ok
    ? (latest.result.headers.find(([n]) => n.toLowerCase() === "content-type")?.[1] ?? "")
    : "";

  return (
    <section className="pg-http" aria-label="HTTP requests">
      {resizer}
      <div className="pg-bar">
        <span>HTTP</span>
        <span className="pg-status" role="status">
          {port === null ? "server not running" : `listening on :${port} (in your browser)`}
        </span>
      </div>
      <form
        className="pg-http-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="pg-http-line">
          <select
            aria-label="Method"
            value={draft.method}
            onChange={(e) => setDraft({ ...draft, method: e.target.value as HttpMethod })}
          >
            {HTTP_METHODS.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <input
            aria-label="Path"
            value={draft.path}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            onChange={(e) => setDraft({ ...draft, path: e.target.value })}
          />
          <button type="submit" className="link" disabled={busy}>
            <i>{busy ? "sending…" : "send"}</i>
          </button>
        </div>
        {presets.length > 0 && (
          <p className="pg-http-presets">
            <span className="pg-muted">try:</span>
            {presets.map((preset) => (
              <button
                key={`${preset.method} ${preset.path}`}
                type="button"
                className="link"
                onClick={() => choosePreset(preset)}
              >
                <i>
                  {preset.method} {preset.path}
                </i>
              </button>
            ))}
          </p>
        )}
        <label>
          <span>Headers</span>
          <textarea
            rows={2}
            value={draft.headers}
            placeholder="Name: value"
            spellCheck={false}
            onChange={(e) => setDraft({ ...draft, headers: e.target.value })}
          />
        </label>
        {draft.method !== "GET" && draft.method !== "HEAD" && (
          <label>
            <span>Body</span>
            <textarea
              rows={3}
              value={draft.body}
              spellCheck={false}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            />
          </label>
        )}
        {problem && (
          <p className="pg-http-error" role="alert">
            {problem}
          </p>
        )}
      </form>
      <div className="pg-http-response" aria-live="polite">
        {latest &&
          (latest.result.ok ? (
            <>
              <p>
                <b>
                  {latest.result.status} {latest.result.statusText}
                </b>{" "}
                <span className="pg-muted">· {latest.result.ms} ms</span>
                {type.includes("html") && (
                  <>
                    {" "}
                    <button
                      type="button"
                      className="link"
                      aria-pressed={asHtml}
                      onClick={() => setAsHtml(!asHtml)}
                    >
                      <i>preview html</i>
                    </button>
                  </>
                )}
              </p>
              <details>
                <summary>headers ({latest.result.headers.length})</summary>
                <pre>{latest.result.headers.map(([n, v]) => `${n}: ${v}`).join("\n")}</pre>
              </details>
              {asHtml && type.includes("html") ? (
                <iframe
                  sandbox=""
                  srcDoc={latest.result.body}
                  title="HTML response"
                  className="pg-http-html"
                />
              ) : (
                <pre className="pg-http-body">
                  {formatBody(latest.result.body, latest.result.headers)}
                  {latest.result.truncated && "\n… (truncated)"}
                </pre>
              )}
            </>
          ) : (
            <p className="pg-http-error" role="alert">
              {latest.result.error}
            </p>
          ))}
        {history.length > 1 && (
          <details className="pg-http-history">
            <summary>history</summary>
            <ul>
              {history.slice(1).map((exchange, i) => (
                <li key={i}>
                  <button type="button" className="link" onClick={() => setDraft(exchange.draft)}>
                    <i>
                      {exchange.draft.method} {exchange.draft.path}
                    </i>
                  </button>{" "}
                  <span className="pg-muted">
                    → {exchange.result.ok ? exchange.result.status : "error"}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </section>
  );
}
