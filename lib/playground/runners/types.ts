/**
 * @file Shared types for the playground's runners.
 */

import type { Stream } from "../output";
import type { Project } from "../project";

/** One piece of output from a run. */
export interface RunEvent {
  readonly stream: Stream;
  readonly text: string;
}

/** Receives output as it arrives. */
export type Emit = (event: RunEvent) => void;

/** What a runner is asked to run. */
export interface RunRequest {
  readonly project: Project;
  /** Text fed to standard input (languages that read it). */
  readonly stdin: string;
  /** Aborted when the user presses Stop or the run times out. */
  readonly signal: AbortSignal;
}

/** How a run ended. */
export interface RunResult {
  /** Process exit code when known; `null` if it never ran (compile error, stopped). */
  readonly exitCode: number | null;
}

/** A `fetch` lookalike, injectable for tests. */
export type Fetch = (input: string, init: RequestInit) => Promise<Response>;
