/**
 * @file Props validation and URLs for the `<YouTube>` embed.
 *
 * Sheets embed videos with `<YouTube id="…" title="…" />`. The props are checked
 * with Zod while the page is rendered at build time, so a mistyped id fails the
 * build instead of shipping a broken player. Embeds use YouTube's
 * privacy-enhanced host, which sets no cookies until the viewer presses play.
 */

import { z } from "zod";

/** A YouTube video id: 11 URL-safe base64 characters. */
export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** Host for embeds that don't set cookies before playback. */
const EMBED_BASE = "https://www.youtube-nocookie.com/embed/";

/** Host for the watch page linked from the caption. */
const WATCH_BASE = "https://www.youtube.com/watch?v=";

/** Schema for the `<YouTube>` props. */
const youtubePropsSchema = z.object({
  id: z.string().regex(YOUTUBE_ID, "must be an 11-character video id"),
  title: z.string().trim().min(1, "is required"),
  channel: z.string().trim().min(1).optional(),
  start: z.number().int().nonnegative().optional(),
});

/** Validated props for `<YouTube>`. */
export type YouTubeProps = z.infer<typeof youtubePropsSchema>;

/**
 * Validate `<YouTube>` props.
 *
 * @param input - The raw props from MDX.
 * @returns The props, typed.
 * @throws Error naming the bad fields, e.g. `Invalid <YouTube> props: id must be …`.
 * @example
 * parseYouTubeProps({ id: "dQw4w9WgXcQ", title: "A video" });
 */
export function parseYouTubeProps(input: unknown): YouTubeProps {
  const result = youtubePropsSchema.safeParse(input);
  if (result.success) return result.data;
  const problems = result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ");
  throw new Error(`Invalid <YouTube> props: ${problems}`);
}

/**
 * The player URL for an iframe.
 *
 * @param id - A valid video id.
 * @param start - Optional start time in whole seconds; `0` is omitted.
 * @param autoplay - Start playing at once (the reader already pressed play on the poster).
 * @returns e.g. `https://www.youtube-nocookie.com/embed/<id>?start=90`.
 */
export function youtubeEmbedUrl(id: string, start?: number, autoplay = false): string {
  const query = [start ? `start=${start}` : "", autoplay ? "autoplay=1" : ""].filter(Boolean);
  return `${EMBED_BASE}${id}${query.length > 0 ? `?${query.join("&")}` : ""}`;
}

/**
 * The video's thumbnail, shown until the reader presses play. `hqdefault` exists
 * for every video (4:3 with bars, which `object-fit: cover` crops away at 16:9).
 *
 * @param id - A valid video id.
 * @returns e.g. `https://i.ytimg.com/vi/<id>/hqdefault.jpg`.
 */
export function youtubeThumbnailUrl(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/**
 * The watch page URL, for the caption link.
 *
 * @param id - A valid video id.
 * @param start - Optional start time in whole seconds; `0` is omitted.
 * @returns e.g. `https://www.youtube.com/watch?v=<id>&t=90s`.
 */
export function youtubeWatchUrl(id: string, start?: number): string {
  return `${WATCH_BASE}${id}${start ? `&t=${start}s` : ""}`;
}
