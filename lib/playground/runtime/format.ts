/**
 * @file Turn `console.log` arguments into text, inside the sandbox.
 *
 * This function is serialized with `toString()` into the worker's source, so
 * it must stay self-contained: no imports, no references to anything outside
 * its own body. It is also imported directly by the unit tests.
 */

/**
 * Format console arguments like a browser console does, in one line of text:
 * strings as-is, other values inspected (objects, arrays, Maps, Sets, errors,
 * cycles) to a bounded depth.
 *
 * @param args - The arguments passed to `console.log` and friends.
 * @returns The line to print, without a trailing newline.
 */
export function formatConsoleArgs(args: readonly unknown[]): string {
  const MAX_DEPTH = 4;
  const MAX_ITEMS = 100;

  const inspect = (value: unknown, depth: number, seen: Set<unknown>): string => {
    if (typeof value === "string") return depth === 0 ? value : JSON.stringify(value);
    if (typeof value === "bigint") return `${value}n`;
    if (typeof value === "symbol") return value.toString();
    if (typeof value === "function") return `[Function ${value.name || "(anonymous)"}]`;
    if (value === null || typeof value !== "object") return String(value);
    if (seen.has(value)) return "[Circular]";
    if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
    if (value instanceof Date) return value.toISOString();
    if (value instanceof RegExp) return String(value);
    if (depth >= MAX_DEPTH) return Array.isArray(value) ? "[Array]" : "[Object]";
    const next = new Set(seen).add(value);
    const inner = (v: unknown) => inspect(v, depth + 1, next);
    const cap = (items: string[], total: number) =>
      total > MAX_ITEMS ? [...items.slice(0, MAX_ITEMS), `… ${total - MAX_ITEMS} more`] : items;
    if (Array.isArray(value)) {
      return `[ ${cap(value.slice(0, MAX_ITEMS).map(inner), value.length).join(", ")} ]`.replace(
        "[  ]",
        "[]",
      );
    }
    if (value instanceof Map) {
      const entries = [...value].slice(0, MAX_ITEMS).map(([k, v]) => `${inner(k)} => ${inner(v)}`);
      return `Map(${value.size}) { ${cap(entries, value.size).join(", ")} }`;
    }
    if (value instanceof Set) {
      return `Set(${value.size}) { ${cap([...value].slice(0, MAX_ITEMS).map(inner), value.size).join(", ")} }`;
    }
    const keys = Object.keys(value);
    const name =
      value.constructor && value.constructor !== Object ? `${value.constructor.name} ` : "";
    const fields = keys
      .slice(0, MAX_ITEMS)
      .map(
        (k) =>
          `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${inner((value as Record<string, unknown>)[k])}`,
      );
    return keys.length === 0 ? `${name}{}` : `${name}{ ${cap(fields, keys.length).join(", ")} }`;
  };

  return args.map((arg) => inspect(arg, 0, new Set())).join(" ");
}
