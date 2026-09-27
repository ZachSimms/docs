/** Unit tests for `lib/youtube.ts` and the `<YouTube>` embed. */
import { describe, expect, it } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { YouTube } from "@/components/YouTube";
import {
  parseYouTubeProps,
  youtubeEmbedUrl,
  youtubeThumbnailUrl,
  youtubeWatchUrl,
} from "@/lib/youtube";

const ID = "dQw4w9WgXcQ";

describe("parseYouTubeProps", () => {
  it("accepts an 11-character id, a title and optional channel and start", () => {
    expect(parseYouTubeProps({ id: ID, title: "A video" })).toEqual({ id: ID, title: "A video" });
    expect(parseYouTubeProps({ id: "a_b-C1d2E3f", title: "t", channel: "c", start: 42 })).toEqual({
      id: "a_b-C1d2E3f",
      title: "t",
      channel: "c",
      start: 42,
    });
  });

  it("rejects bad ids, empty titles and bad start times", () => {
    expect(() => parseYouTubeProps({ id: "short", title: "t" })).toThrow(/YouTube/);
    expect(() => parseYouTubeProps({ id: `${ID}x`, title: "t" })).toThrow(/YouTube/);
    expect(() => parseYouTubeProps({ id: "dQw4w9WgXc?", title: "t" })).toThrow(/YouTube/);
    expect(() => parseYouTubeProps({ id: ID, title: " " })).toThrow(/YouTube/);
    expect(() => parseYouTubeProps({ id: ID, title: "t", start: -1 })).toThrow(/YouTube/);
    expect(() => parseYouTubeProps({ id: ID, title: "t", start: 1.5 })).toThrow(/YouTube/);
  });
});

describe("youtube urls", () => {
  it("embeds from the privacy-enhanced host, with an optional start", () => {
    expect(youtubeEmbedUrl(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}`);
    expect(youtubeEmbedUrl(ID, 0)).toBe(`https://www.youtube-nocookie.com/embed/${ID}`);
    expect(youtubeEmbedUrl(ID, 90)).toBe(`https://www.youtube-nocookie.com/embed/${ID}?start=90`);
    expect(youtubeEmbedUrl(ID, 0, true)).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?autoplay=1`,
    );
    expect(youtubeEmbedUrl(ID, 90, true)).toBe(
      `https://www.youtube-nocookie.com/embed/${ID}?start=90&autoplay=1`,
    );
    expect(youtubeThumbnailUrl(ID)).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
  });

  it("links to the watch page, with an optional timestamp", () => {
    expect(youtubeWatchUrl(ID)).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(youtubeWatchUrl(ID, 90)).toBe(`https://www.youtube.com/watch?v=${ID}&t=90s`);
  });
});

describe("<YouTube>", () => {
  it("shows a thumbnail link until play is pressed, then the titled, autoplaying player", () => {
    const { container } = render(
      <YouTube id={ID} title="A-skips drill" channel="Coach" start={30} />,
    );
    // Nothing from YouTube's player loads with the page.
    expect(container.querySelector("iframe")).toBeNull();
    const poster = container.querySelector("figure.video .video-frame a.video-poster")!;
    expect(poster.getAttribute("href")).toBe(youtubeWatchUrl(ID, 30));
    expect(poster.getAttribute("aria-label")).toBe("Play video: A-skips drill");
    expect(poster.getAttribute("rel")).toBe("noopener noreferrer");
    const thumb = poster.querySelector("img")!;
    expect(thumb.getAttribute("src")).toBe(youtubeThumbnailUrl(ID));
    expect(thumb.getAttribute("loading")).toBe("lazy");
    expect(thumb.getAttribute("referrerpolicy")).toBe("no-referrer");

    fireEvent.click(poster);
    const iframe = container.querySelector("figure.video .video-frame iframe");
    expect(iframe?.getAttribute("src")).toBe(youtubeEmbedUrl(ID, 30, true));
    expect(iframe?.getAttribute("title")).toBe("YouTube video: A-skips drill");
    expect(iframe?.getAttribute("allow")).toContain("autoplay");
    expect(iframe?.getAttribute("referrerpolicy")).toBe("strict-origin-when-cross-origin");
    expect(iframe?.hasAttribute("allowfullscreen")).toBe(true);
    expect(document.activeElement).toBe(iframe);
    const link = container.querySelector("figcaption a");
    expect(link?.getAttribute("href")).toBe(youtubeWatchUrl(ID, 30));
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(container.querySelector("figcaption")?.textContent).toContain("Coach");
  });

  it("leaves the channel out of the caption when none is given", () => {
    const { container } = render(<YouTube id={ID} title="Solo" />);
    expect(container.querySelector("figcaption")?.textContent).toBe(
      "Solo (opens in a new tab) (YouTube)",
    );
  });

  it("throws on an invalid id so the build fails", () => {
    expect(() => render(<YouTube id="nope" title="t" />)).toThrow(/YouTube/);
  });
});
