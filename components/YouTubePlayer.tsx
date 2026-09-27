/**
 * @file The click-to-load player inside `<YouTube>`.
 *
 * Client component. Until the reader presses play it is only a link to the
 * watch page showing the video's thumbnail: no player (~1 MB of script per
 * video) and nothing from youtube.com loads with the page. Pressing it swaps
 * in the privacy-enhanced player, autoplaying, and moves focus into it.
 * Without JavaScript the link still opens the video on YouTube.
 */

"use client";

import { useEffect, useRef, useState } from "react";

/** What the player may use; autoplay only once the reader asked for the video. */
const ALLOW = "autoplay; encrypted-media; picture-in-picture; fullscreen";

/** Props for {@link YouTubePlayer}; URLs are built (and the id validated) on the server. */
interface YouTubePlayerProps {
  title: string;
  /** The embed URL, autoplaying. */
  embedUrl: string;
  /** The watch page, for the poster link. */
  watchUrl: string;
  thumbnailUrl: string;
}

/** Render the poster, or the player once pressed. */
export function YouTubePlayer({ title, embedUrl, watchUrl, thumbnailUrl }: YouTubePlayerProps) {
  const [playing, setPlaying] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);

  // The poster had focus (keyboard users pressed it): keep focus on the video, not <body>.
  useEffect(() => {
    if (playing) frame.current?.focus();
  }, [playing]);

  if (playing) {
    return (
      <iframe
        ref={frame}
        src={embedUrl}
        title={`YouTube video: ${title}`}
        allow={ALLOW}
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    );
  }
  return (
    <a
      className="video-poster"
      href={watchUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Play video: ${title}`}
      onClick={(event) => {
        // Modified clicks (new tab, …) keep their meaning.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        setPlaying(true);
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- remote thumbnail, fixed 16:9 box */}
      <img src={thumbnailUrl} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" />
      <span className="video-play" aria-hidden="true" />
    </a>
  );
}
