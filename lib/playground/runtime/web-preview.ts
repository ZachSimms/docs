/**
 * @file The HTML/CSS/JS live preview's document.
 *
 * The user's linked page (see `linkWebDocument`) goes in an
 * `<iframe sandbox="allow-scripts allow-forms" srcdoc>` (`PREVIEW_SANDBOX_FLAGS`), an opaque
 * origin. A small shim is
 * injected first so `console.*`, uncaught errors and unhandled rejections are
 * posted to the page with the current token; the page filters them with
 * `acceptFrameMessage` like any other sandbox message.
 */

import { formatConsoleArgs } from "./format";
import { firstTag } from "../tags";

/** The global the preview's loop guards call (see `loop-guard.ts`); returns `true` or throws. */
export const LOOP_GUARD = "__playgroundLoopGuard";

/** How long one task may loop without yielding before the guard throws. */
export const LOOP_LIMIT_MS = 1000;

/**
 * The loop guard, serialized into the preview (so it must be self-contained).
 * Only every 64th call reads the clock. The first read of a busy stretch arms a
 * zero-delay timer that disarms it; that timer can only run once the page
 * yields, so if the clock passes the limit while still armed, the current task
 * (or an unbroken chain of microtasks) has been looping the whole time.
 *
 * @param limitMs - {@link LOOP_LIMIT_MS}.
 * @returns The function to install as {@link LOOP_GUARD}.
 */
export function createLoopGuard(limitMs: number): () => true {
  let calls = 0;
  let busySince = 0;
  let armed = false;
  return () => {
    if ((++calls & 63) !== 0) return true;
    const now = performance.now();
    if (!armed) {
      armed = true;
      busySince = now;
      setTimeout(() => {
        armed = false;
      }, 0);
    } else if (now - busySince > limitMs) {
      throw new RangeError(
        `Stopped a loop that ran for over ${limitMs / 1000} s without letting the page ` +
          "update (an infinite loop?). Loops that need longer can await between steps.",
      );
    }
    return true;
  };
}

/**
 * Runs first inside the preview: forwards console output and errors to the
 * parent. Serialized with `toString()`, so it must be self-contained.
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

/** Escape `</script` so serialized code can't close its script element. */
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
    `(${previewShim.toString()})(${JSON.stringify(token)}, ${formatConsoleArgs.toString()});` +
      `globalThis[${JSON.stringify(LOOP_GUARD)}] = (${createLoopGuard.toString()})(${LOOP_LIMIT_MS});`,
  )}</script>`;
  // Scanned, not matched with `/<head\b[^>]*>/i`: that is quadratic on unclosed tags.
  const tag = firstTag(html, /<head\b/i) ?? firstTag(html, /<!doctype/i);
  if (tag) {
    const end = tag.index + tag.text.length;
    return html.slice(0, end) + shim + html.slice(end);
  }
  return `<!doctype html>${shim}${html}`;
}
