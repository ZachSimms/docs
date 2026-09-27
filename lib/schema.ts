/**
 * @file Zod schema for cheatsheet frontmatter.
 *
 * Every `.mdx` file under `content/` must start with a YAML block that satisfies
 * {@link frontmatterSchema}. Validation happens at build time in `lib/content.ts`,
 * so a malformed file fails the build with a message naming the file.
 */

import { z } from "zod";
import { formatDate } from "./format";

/** Strict `YYYY-MM-DD` shape for quoted date strings. */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Frontmatter accepted by a cheatsheet.
 *
 * - `title`: non-empty after trimming.
 * - `date`: either a `Date` (what the YAML parser yields for a bare `2026-09-04`)
 *   or a quoted `"YYYY-MM-DD"` string. Both normalize to the string form.
 *   Free-form strings such as `"May 5 2026"` are rejected rather than parsed in
 *   local time, which could shift the day.
 * - `order` (optional): non-negative integer. Sheets that have one are listed
 *   first, ascending; sheets without one follow, newest first.
 */
export const frontmatterSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  date: z.union([
    z.date().transform(formatDate),
    z.string().regex(ISO_DATE, "date must be YYYY-MM-DD"),
  ]),
  order: z.number().int().nonnegative("order must be a non-negative integer").optional(),
});

/** The parsed, normalized frontmatter: `{ title: string; date: "YYYY-MM-DD"; order?: number }`. */
export type Frontmatter = z.infer<typeof frontmatterSchema>;

/**
 * Frontmatter accepted by a blog post (`posts/<slug>.mdx`).
 *
 * - `title`, `date`: as for a sheet.
 * - `summary` (optional): one or two sentences, shown as the excerpt on `/blog/`.
 * - `tags` (optional): short lowercase labels, shown as chips.
 */
export const postSchema = z.object({
  title: z.string().trim().min(1, "title is required"),
  date: frontmatterSchema.shape.date,
  summary: z.string().trim().min(1, "summary must not be empty").optional(),
  tags: z.array(z.string().trim().min(1, "tags must not be empty")).optional(),
});

/** The parsed, normalized frontmatter of a post. */
export type PostFrontmatter = z.infer<typeof postSchema>;
