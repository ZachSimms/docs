/**
 * @file Small, pure formatting helpers shared by the server and the client.
 *
 * Everything here is deterministic and side-effect free, so it can be used in
 * server components, client components and the build-time search index alike.
 */

/**
 * Zero-pad a non-negative integer to at least two digits, matching the
 * `00.` … `46.` numbering style of the original site.
 *
 * @param n - A non-negative integer.
 * @returns The number as a string, left-padded with `0` to a minimum width of two.
 * @throws {RangeError} If `n` is negative or not an integer.
 * @example
 * padNumber(9);  // "09"
 * padNumber(46); // "46"
 */
export function padNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0) {
    throw new RangeError(`padNumber expects a non-negative integer, got ${n}`);
  }
  return String(n).padStart(2, "0");
}

/**
 * Format a `Date` as `YYYY-MM-DD` using its UTC calendar date.
 *
 * UTC is used deliberately: YAML frontmatter dates are parsed as midnight UTC,
 * so formatting in local time could shift the day for readers west of Greenwich.
 *
 * @param date - Any valid `Date`.
 * @returns The ISO calendar date, e.g. `"2026-09-04"`.
 */
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
