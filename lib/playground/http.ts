/**
 * @file Requests and responses of the HTTP panel (server projects).
 *
 * Pure. The panel's fields become a request for the emulated server inside
 * the sandbox; nothing is sent over the network.
 */

/** HTTP methods the panel offers. */
export const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

/** What the reader typed into the panel. */
export interface HttpDraft {
  readonly method: HttpMethod;
  /** Path and query, e.g. `/users/1?full=true`. */
  readonly path: string;
  /** One `Name: value` per line. */
  readonly headers: string;
  readonly body: string;
}

/** A request ready to post to the sandbox. */
export interface HttpRequestMessage {
  readonly id: string;
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers: [string, string][];
  readonly body: string;
}

/** A response (or an error) from the sandbox. */
export type HttpResult =
  | {
      readonly ok: true;
      readonly status: number;
      readonly statusText: string;
      readonly headers: readonly [string, string][];
      readonly body: string;
      readonly truncated: boolean;
      readonly ms: number;
    }
  | { readonly ok: false; readonly error: string };

/** A header name (RFC 9110 token). */
const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

/**
 * Parse `Name: value` lines. Blank lines are skipped.
 *
 * @returns The headers, or the first line that isn't a valid header.
 */
export function parseHeaderLines(
  text: string,
): { headers: [string, string][] } | { error: string } {
  const headers: [string, string][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const colon = line.indexOf(":");
    const name = colon === -1 ? "" : line.slice(0, colon).trim();
    if (!HEADER_NAME.test(name))
      return { error: `Not a header line: "${line.trim()}" (use Name: value)` };
    headers.push([name, line.slice(colon + 1).trim()]);
  }
  return { headers };
}

/**
 * Build the request for the emulated server.
 *
 * @param draft - The panel's fields.
 * @param port - The port `Bun.serve` reported.
 * @param id - A unique id to match the response.
 * @returns The request, or a message to show when a field is invalid.
 */
export function buildHttpRequest(
  draft: HttpDraft,
  port: number,
  id: string,
): HttpRequestMessage | { error: string } {
  const path = draft.path.trim() || "/";
  if (!path.startsWith("/") || path.startsWith("//"))
    return { error: "The path must start with a single /" };
  const parsed = parseHeaderLines(draft.headers);
  if ("error" in parsed) return parsed;
  const headers = parsed.headers;
  const hasBody = draft.method !== "GET" && draft.method !== "HEAD" && draft.body.length > 0;
  const looksJson = /^\s*[[{]/.test(draft.body);
  const hasType = headers.some(([name]) => name.toLowerCase() === "content-type");
  return {
    id,
    method: draft.method,
    url: new URL(path, `http://localhost:${port}`).href,
    headers:
      hasBody && looksJson && !hasType
        ? [...headers, ["content-type", "application/json"]]
        : headers,
    body: hasBody ? draft.body : "",
  };
}

/** Pretty-print a JSON body; anything else is returned as it is. */
export function formatBody(body: string, headers: readonly [string, string][]): string {
  const type = headers.find(([name]) => name.toLowerCase() === "content-type")?.[1] ?? "";
  if (!type.includes("json") && !/^\s*[[{]/.test(body)) return body;
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
