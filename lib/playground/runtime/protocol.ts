/**
 * @file Messages between the playground page and its sandboxed frames.
 *
 * The sandboxes (runner frame, web preview, Godot frame) run untrusted code at
 * an opaque origin, so everything they post is treated as hostile: the page
 * only accepts a message whose `event.source` is the frame it created, whose
 * `token` matches the current run, and which parses with {@link frameMessage}.
 * Text is capped per message; rendering is as plain text only.
 */

import { z } from "zod";

/** Longest text accepted in one message (larger chunks are cut). */
export const MAX_MESSAGE_TEXT = 64 * 1024;

const text = z.string().transform((s) => s.slice(0, MAX_MESSAGE_TEXT));

/** Anything a sandbox may send the page. */
export const frameMessage = z.discriminatedUnion("type", [
  /** The frame has loaded and listens for work. */
  z.object({ type: z.literal("ready"), token: z.string().optional() }),
  /** Program output. */
  z.object({
    type: z.literal("out"),
    token: z.string(),
    stream: z.enum(["stdout", "stderr", "info"]),
    text,
  }),
  /** The program finished (its top level returned or threw). */
  z.object({ type: z.literal("done"), token: z.string(), exitCode: z.number().int().nullable() }),
  /** Download or start-up progress, shown in place (e.g. "Loading Godot… 40%"). */
  z.object({ type: z.literal("progress"), token: z.string(), text }),
]);

/** A validated message from a sandbox. */
export type FrameMessage = z.infer<typeof frameMessage>;

/**
 * Accept a `message` event only from the expected frame, for the current run.
 *
 * @param event - The window `message` event.
 * @param frame - The iframe's `contentWindow` the page created.
 * @param token - The current run's token (`ready` messages need none).
 * @returns The parsed message, or `null` to ignore it.
 */
export function acceptFrameMessage(
  event: Pick<MessageEvent, "source" | "data">,
  frame: Window | null | undefined,
  token: string | null,
): FrameMessage | null {
  if (!frame || event.source !== frame) return null;
  const parsed = frameMessage.safeParse(event.data);
  if (!parsed.success) return null;
  const message = parsed.data;
  if (message.type === "ready") return message;
  return message.token === token ? message : null;
}

/** A fresh unguessable token for one run. */
export function newRunToken(): string {
  return crypto.randomUUID();
}

/** Work the page sends the runner frame. */
export type RunnerCommand =
  | { type: "run"; token: string; kind: "js"; entryUrl: string }
  | {
      type: "run";
      token: string;
      kind: "python";
      files: Record<string, string>;
      entry: string;
      stdin: string;
      indexUrl: string;
    };
