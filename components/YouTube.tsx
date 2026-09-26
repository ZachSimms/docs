/**
 * @file `<YouTube>`: an embedded YouTube video with a caption link.
 *
 * Server component. Props are validated by `lib/youtube.ts` (a bad id fails the
 * build). The player is a lazily loaded iframe from the privacy-enhanced host,
 * kept at 16:9 by CSS (`.video-frame`); the caption links to the watch page and
 * names the channel.
 *
 * @example
 * <YouTube id="dQw4w9WgXcQ" title="A-skips" channel="Some Coach" start={30} />
 */

import { DottedLink } from "@/components/DottedLink";
import { parseYouTubeProps, youtubeEmbedUrl, youtubeWatchUrl } from "@/lib/youtube";

/** What the player may use; autoplay is left out on purpose. */
const ALLOW = "encrypted-media; picture-in-picture; fullscreen";

/** Props for {@link YouTube}. */
interface YouTubeComponentProps {
  /** The 11-character video id (the `v=` value). */
  id: string;
  /** The video's title, used for the iframe label and the caption. */
  title: string;
  /** Optional channel name shown after the title. */
  channel?: string;
  /** Optional start time in whole seconds. */
  start?: number;
}

/** Render `figure.video > .video-frame > iframe` + `figcaption`. */
export function YouTube(props: YouTubeComponentProps) {
  const { id, title, channel, start } = parseYouTubeProps(props);
  return (
    <figure className="video">
      <div className="video-frame">
        <iframe
          src={youtubeEmbedUrl(id, start)}
          title={`YouTube video: ${title}`}
          loading="lazy"
          allow={ALLOW}
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      <figcaption>
        <DottedLink href={youtubeWatchUrl(id, start)} inline>
          {title}
        </DottedLink>{" "}
        ({channel ? `${channel}, ` : ""}YouTube)
      </figcaption>
    </figure>
  );
}
