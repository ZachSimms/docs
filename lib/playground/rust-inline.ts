/**
 * @file Turn a multi-file Rust crate into one file the online compilers accept.
 *
 * Starting at the entry (`src/main.rs`), every `mod name;` declaration is
 * replaced by `mod name { … }` holding the contents of `name.rs` or
 * `name/mod.rs`, recursively, which is exactly what rustc does with files.
 * So `mod`, `pub`, `use crate::…` and `super::` behave as in a real crate.
 * Not supported: `#[path = "…"]` attributes and external crates.
 *
 * Each output line remembers the file and line it came from, so compiler
 * messages (`<source>:12:5`) can be pointed back at `src/geometry.rs:3:5`.
 */

import { dirname, hasFile, joinPath } from "./project";

/** Where one line of the inlined source came from. */
export interface SourceLine {
  readonly file: string;
  /** 1-based line number in that file. */
  readonly line: number;
}

/** The single-file crate and its line map (`lines[i]` is output line i + 1). */
export interface InlinedCrate {
  readonly code: string;
  readonly lines: readonly SourceLine[];
}

/** A `mod name;` line (optionally `pub`/`pub(crate)`), with a trailing comment allowed. */
const MOD_DECL =
  /^(\s*)((?:pub(?:\s*\([^)]*\))?\s+)?)mod\s+([A-Za-z_][A-Za-z0-9_]*)\s*;\s*(?:\/\/.*)?$/;

/** A problem assembling the crate, phrased for the console. */
export class RustModuleError extends Error {
  override name = "RustModuleError";
}

/** Directory that holds the child modules of `file`. */
function childDir(file: string): string {
  const name = file.slice(file.lastIndexOf("/") + 1);
  const dir = dirname(file);
  // main.rs, lib.rs and mod.rs own their directory; foo.rs owns foo/.
  return ["main.rs", "lib.rs", "mod.rs"].includes(name) ? dir : joinPath(dir, name.slice(0, -3));
}

/**
 * Inline every file module into the entry.
 *
 * @param files - The project's files.
 * @param entry - The crate root, usually `src/main.rs`.
 * @returns One source file plus its line map.
 * @throws {RustModuleError} When a module's file is missing or modules form a cycle.
 */
export function inlineRustModules(
  files: Readonly<Record<string, string>>,
  entry: string,
): InlinedCrate {
  const code: string[] = [];
  const lines: SourceLine[] = [];
  const active: string[] = [];

  const emit = (text: string, file: string, line: number) => {
    code.push(text);
    lines.push({ file, line });
  };

  const inline = (file: string) => {
    if (active.includes(file)) {
      throw new RustModuleError(`Module cycle: ${[...active, file].join(" → ")}.`);
    }
    active.push(file);
    (files[file] ?? "").split("\n").forEach((text, i) => {
      const match = MOD_DECL.exec(text);
      if (!match || text.trimStart().startsWith("//")) {
        emit(text, file, i + 1);
        return;
      }
      const [, indent = "", visibility = "", name = ""] = match;
      const dir = childDir(file);
      const options = [joinPath(dir, `${name}.rs`), joinPath(dir, `${name}/mod.rs`)];
      const found = options.find((o) => hasFile(files, o));
      if (!found) {
        throw new RustModuleError(
          `${file}:${i + 1}: file not found for module \`${name}\`: create ${options[0]} or ${options[1]}.`,
        );
      }
      emit(`${indent}${visibility}mod ${name} {`, file, i + 1);
      inline(found);
      emit(`${indent}}`, file, i + 1);
    });
    active.pop();
  };

  inline(entry);
  return { code: code.join("\n"), lines };
}

/** Positions in compiler output: `<source>:12:5` (Compiler Explorer) or `src/main.rs:12:5` (Rust Playground). */
const POSITION = /(?:<source>|src\/main\.rs):(\d+):(\d+)/g;

/**
 * Point compiler positions back at the original files.
 *
 * @param text - Compiler output.
 * @param lines - The line map from {@link inlineRustModules}.
 * @returns The text with `<source>:L:C` replaced by `file:line:C`.
 */
export function mapRustPositions(text: string, lines: readonly SourceLine[]): string {
  return text.replace(POSITION, (whole, line: string, col: string) => {
    const origin = lines[Number(line) - 1];
    return origin ? `${origin.file}:${origin.line}:${col}` : whole;
  });
}
