/**
 * @file TypeScript/JSX → JavaScript for the playground, with Sucrase.
 *
 * Types are stripped, not checked (TypeScript 7's compiler has no JS API yet,
 * and the TS 6 compiler is 1.5 MB). Modern syntax is left alone, lines keep
 * their numbers (so runtime errors point at the right line), and JSX uses the
 * automatic runtime: `react/jsx-runtime` resolves to esm.sh like any bare
 * import. Plain `.js` files pass through untouched.
 */

import { transform, type Transform } from "sucrase";

/** Sucrase transforms per file extension; anything missing is left as is. */
const TRANSFORMS: Readonly<Record<string, Transform[]>> = {
  ts: ["typescript"],
  mts: ["typescript"],
  cts: ["typescript"],
  tsx: ["typescript", "jsx"],
  jsx: ["jsx"],
};

/**
 * Compile one file to plain JavaScript.
 *
 * @param path - The file's project path (its extension picks the transforms).
 * @param code - Its source.
 * @returns JavaScript with the same line numbers.
 * @throws {Error} On a syntax error, with the file name and position in the message.
 */
export function transpile(path: string, code: string): string {
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  const transforms = TRANSFORMS[ext];
  if (!transforms) return code;
  try {
    return transform(code, {
      transforms,
      disableESTransforms: true,
      jsxRuntime: "automatic",
      production: true,
      filePath: path,
    }).code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${path}: ${message}`);
  }
}
