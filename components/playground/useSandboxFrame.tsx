/**
 * @file A sandboxed iframe the page talks to: send commands, receive validated messages.
 *
 * Client hook. The frame is `sandbox="allow-scripts"` only (opaque origin; no
 * same-origin, popups, top navigation, modals or forms), so code inside can't
 * reach the site's storage or DOM and `alert()` can't block the page. Messages
 * are accepted only from this frame's window, for the current token, and only
 * if they parse (see `acceptFrameMessage`). `reset()` replaces the frame, which
 * kills anything running inside it (the Stop button and time limits use it).
 */

"use client";

import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { acceptFrameMessage, type FrameMessage } from "@/lib/playground/runtime/protocol";

/** The only sandbox flags any playground frame gets. */
export const SANDBOX_FLAGS = "allow-scripts";

/** Where the frame's document comes from. */
type FrameSource = { srcDoc: string; src?: never } | { src: string; srcDoc?: never };

/** A promise for the ready frame's window, plus its resolver. */
function deferred() {
  let resolve!: (frame: Window) => void;
  const promise = new Promise<Window>((r) => (resolve = r));
  return { promise, resolve };
}

/** What {@link useSandboxFrame} returns. */
export interface SandboxFrame {
  /** The iframe element to render (hidden by CSS unless the caller shows it). */
  element: ReactElement | null;
  /** Start using a token and post a command once the frame is ready. */
  send(command: { token: string } & Record<string, unknown>): Promise<void>;
  /** Replace the frame (kills everything in it). */
  reset(): void;
  /** Ignore messages from now on (a stopped run). */
  forget(): void;
  /** Post a follow-up message for the current run (e.g. an HTTP panel request). */
  post(message: Record<string, unknown>): Promise<boolean>;
}

/**
 * Own one sandboxed frame.
 *
 * @param source - `srcDoc` or `src` for the frame's document.
 * @param title - Accessible name of the frame.
 * @param onMessage - Called with each accepted message (not `ready`).
 * @param enabled - Mount the frame only once it is first needed.
 * @param hidden - Whether the frame is out of sight (the runner); a visible frame (the
 *   Godot view) stays in the accessibility tree and the tab order.
 */
export function useSandboxFrame(
  source: FrameSource,
  title: string,
  onMessage: (message: FrameMessage) => void,
  enabled: boolean,
  hidden = true,
): SandboxFrame {
  const frame = useRef<HTMLIFrameElement>(null);
  const token = useRef<string | null>(null);
  const ready = useRef(deferred());
  /** Windows of frames already replaced: a late "ready" from one must not count for its successor. */
  const retired = useRef(new WeakSet<Window>());
  const handler = useRef(onMessage);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    handler.current = onMessage;
  });

  useEffect(() => {
    const onWindowMessage = (event: MessageEvent) => {
      const source = event.source as Window | null;
      if (source && retired.current.has(source)) return;
      const message = acceptFrameMessage(event, frame.current?.contentWindow, token.current);
      if (!message) return;
      if (message.type === "ready") ready.current.resolve(source as Window);
      else handler.current(message);
    };
    window.addEventListener("message", onWindowMessage);
    return () => window.removeEventListener("message", onWindowMessage);
  }, []);

  const send = useCallback(async (command: { token: string } & Record<string, unknown>) => {
    token.current = command.token;
    const target = await ready.current.promise;
    if (token.current !== command.token || retired.current.has(target)) return; // superseded
    // An opaque-origin frame can only be addressed with "*"; it holds nothing but the user's own code.
    target.postMessage(command, "*");
  }, []);

  const reset = useCallback(() => {
    const old = frame.current?.contentWindow;
    if (old) retired.current.add(old);
    token.current = null;
    ready.current = deferred();
    setGeneration((g) => g + 1);
  }, []);

  const forget = useCallback(() => {
    token.current = null;
  }, []);

  const post = useCallback(async (message: Record<string, unknown>) => {
    const current = token.current;
    if (!current) return false;
    const target = await ready.current.promise;
    if (token.current !== current || retired.current.has(target)) return false;
    target.postMessage({ ...message, token: current }, "*");
    return true;
  }, []);

  const element = enabled ? (
    <iframe
      key={generation}
      ref={frame}
      sandbox={SANDBOX_FLAGS}
      title={title}
      className="pg-sandbox"
      tabIndex={hidden ? -1 : undefined}
      aria-hidden={hidden ? "true" : undefined}
      {...source}
    />
  ) : null;

  return { element, send, reset, forget, post };
}
