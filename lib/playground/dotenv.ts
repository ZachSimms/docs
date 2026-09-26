/**
 * @file A small `.env` parser for the emulated Bun runtime (`Bun.env`, `process.env`).
 *
 * `KEY=value` lines; `#` comments and blank lines are skipped; single or
 * double quotes around a value are removed (`\n` is expanded inside double
 * quotes); an optional leading `export ` is allowed. Keys must be shell-like
 * identifiers; other lines are ignored.
 */

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/;

/**
 * Parse a `.env` file.
 *
 * @param text - The file's contents.
 * @returns Variables in file order (later duplicates win).
 */
export function parseDotEnv(text: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const raw of text.split(/\r?\n/)) {
    if (/^\s*(#|$)/.test(raw)) continue;
    const match = LINE.exec(raw);
    if (!match) continue;
    const [, key = "", rest = ""] = match;
    let value = rest;
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, "\n");
    } else {
      value = value.replace(/\s+#.*$/, ""); // trailing comment on an unquoted value
    }
    env[key] = value;
  }
  return env;
}
