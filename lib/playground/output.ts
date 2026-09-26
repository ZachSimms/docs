/**
 * @file The console's output model: chunks by stream, capped in size.
 *
 * Output from user code and remote compilers is untrusted text. It is kept as
 * plain strings (rendered as React text nodes, never HTML), stripped of ANSI
 * escape codes, and capped so a runaway `print` loop can't exhaust memory.
 */

/** Which stream a chunk belongs to. `info` is the playground's own messages. */
export type Stream = "stdout" | "stderr" | "info";

/** One piece of output. */
export interface OutputChunk {
  readonly stream: Stream;
  readonly text: string;
}

/** The console's contents. */
export interface Output {
  readonly chunks: readonly OutputChunk[];
  /** Characters held. */
  readonly size: number;
  /** Whether output was dropped after reaching the cap. */
  readonly truncated: boolean;
}

/** Limits on what the console keeps. */
export const OUTPUT_LIMITS = { maxChunks: 5000, maxChars: 1_000_000 } as const;

/** An empty console. */
export const EMPTY_OUTPUT: Output = { chunks: [], size: 0, truncated: false };

/** ANSI CSI/OSC escape sequences (colors, cursor moves) that compilers emit. */
const ANSI = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\))/g;

/** Remove ANSI escape codes. */
export function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

/**
 * Append a chunk, merging it into the previous chunk of the same stream and
 * stopping (with `truncated`) at {@link OUTPUT_LIMITS}.
 *
 * @param output - The current output (not modified).
 * @param stream - The chunk's stream.
 * @param text - Raw text; ANSI codes are removed.
 * @returns The new output.
 */
export function appendOutput(output: Output, stream: Stream, text: string): Output {
  if (output.truncated || text === "") return output;
  const clean = stripAnsi(text);
  const room = OUTPUT_LIMITS.maxChars - output.size;
  const kept = clean.slice(0, Math.max(0, room));
  const truncated = kept.length < clean.length;
  const last = output.chunks.at(-1);
  if (last && last.stream === stream) {
    const chunks = [...output.chunks.slice(0, -1), { stream, text: last.text + kept }];
    return { chunks, size: output.size + kept.length, truncated };
  }
  if (output.chunks.length >= OUTPUT_LIMITS.maxChunks) return { ...output, truncated: true };
  return {
    chunks: [...output.chunks, { stream, text: kept }],
    size: output.size + kept.length,
    truncated,
  };
}

/** All output as one string (for Copy). */
export function outputText(output: Output): string {
  return output.chunks.map((c) => c.text).join("");
}
