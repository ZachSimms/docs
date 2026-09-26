/**
 * @file The HTML/CSS/JS live preview's document.
 *
 * The user's linked page (see `linkWebDocument`) goes in an
 * `<iframe sandbox="allow-scripts" srcdoc>`, an opaque origin. A small shim is
 * injected first so `console.*`, uncaught errors and unhandled rejections are
 * posted to the page with the current token; the page filters them with
 * `acceptFrameMessage` like any other sandbox message.
 */

import { formatConsoleArgs } from "./format";

/**
 * Runs first inside the preview: forwards console output and errors to the
 * parent. Serialised with `toString()`, so it must be self-contained.
 *
 * @param token - The current preview run's token.
 * @param format - {@link formatConsoleArgs}.
 */
export function previewShim(token: string, format: (args: readonly unknown[]) => string): void {
  const post = (stream: string, text: string) =>
    parent.postMessage({ type: "out", token, stream, text }, "*");
  const sink = console as unknown as Record<string, (...args: unknown[]) => void>;
  for (const method of ["log", "info", "debug", "dir", "table"]) {
    sink[method] = (...args: unknown[]) => post("stdout", `${format(args)}\n`);
  }
  for (const method of ["warn", "error", "trace"]) {
    sink[method] = (...args: unknown[]) => post("stderr", `${format(args)}\n`);
  }
  addEventListener("error", (event: ErrorEvent) => {
    const where = event.filename ? ` (${event.filename}:${event.lineno}:${event.colno})` : "";
    post("stderr", `${event.error instanceof Error ? event.error.stack : event.message}${where}\n`);
  });
  addEventListener("unhandledrejection", (event: PromiseRejectionEvent) =>
    post("stderr", `Uncaught (in promise) ${format([event.reason])}\n`),
  );
}

/** Escape `</script` so serialised code can't close its script element. */
const safeScript = (code: string) => code.replace(/<\/(script)/gi, "<\\/$1");

/**
 * Build the preview document: the shim, then the user's page.
 *
 * @param html - The linked page.
 * @param token - The preview run's token (echoed in every message).
 * @returns `srcdoc` HTML. The shim goes right after `<head>` (or the doctype)
 *   so the page keeps standards mode.
 */
export function buildPreviewSrcDoc(html: string, token: string): string {
  const shim = `<script>${safeScript(
    `(${previewShim.toString()})(${JSON.stringify(token)}, ${formatConsoleArgs.toString()});`,
  )}</script>`;
  const head = /<head\b[^>]*>/i.exec(html);
  if (head)
    return (
      html.slice(0, head.index + head[0].length) + shim + html.slice(head.index + head[0].length)
    );
  const doctype = /<!doctype[^>]*>/i.exec(html);
  if (doctype) {
    const end = doctype.index + doctype[0].length;
    return html.slice(0, end) + shim + html.slice(end);
  }
  return `<!doctype html>${shim}${html}`;
}
