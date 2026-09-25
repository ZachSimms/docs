/**
 * @file Renderer for Markdown images (`![alt](src)`) inside MDX.
 *
 * Registered as the `img` component in `mdx-components.tsx`. Server component:
 * it measures local files at render time via `lib/images.ts`.
 */

import Image from "next/image";
import type { ImgHTMLAttributes } from "react";
import { readImageDimensions } from "@/lib/images";

/** Responsive `sizes` hint: full viewport on phones, the 64-character column otherwise. */
const SIZES = "(max-width: 600px) 100vw, 64ch";

/**
 * Render an MDX image.
 *
 * Files under `public/` (URL paths starting with `/`) get `next/image` with
 * their real width and height, read at build time, so the layout reserves
 * space and the browser receives optimised sizes. Anything else, such as a
 * remote URL, falls back to a plain lazily-loaded `<img>`. An empty or
 * non-string `src` renders nothing.
 *
 * @param props - Standard `<img>` attributes as produced by MDX; only `src`,
 *   `alt` and `title` are used.
 */
export function MdxImage({ src, alt = "", title }: ImgHTMLAttributes<HTMLImageElement>) {
  if (typeof src !== "string" || src.length === 0) return null;
  const dimensions = readImageDimensions(src);
  if (dimensions) {
    return (
      <Image
        src={src}
        alt={alt}
        title={title}
        width={dimensions.width}
        height={dimensions.height}
        sizes={SIZES}
        style={{ width: "100%", height: "auto" }}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- remote or unknown image, dimensions unavailable
  return <img src={src} alt={alt} title={title} loading="lazy" decoding="async" />;
}
