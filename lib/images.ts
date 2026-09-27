/**
 * @file Build-time image measurement for MDX images.
 *
 * `next/image` needs a width and height to reserve space and avoid layout
 * shift. Authors write plain `![alt](/images/x.png)`, and this module looks the
 * dimensions up from the file under `public/` while the page is rendered on
 * the server.
 */

import fs from "node:fs";
import path from "node:path";
import { cache } from "react";
import { imageSize } from "image-size";

/** Intrinsic pixel size of an image. */
export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

/** Absolute path of the `public/` folder in the current working directory. */
export const PUBLIC_ROOT = path.join(process.cwd(), "public");

/**
 * Dimensions of a file under `public/`, addressed by its URL path.
 *
 * Memoised with React `cache` per `(publicPath, publicRoot)` for one render, so
 * an image used several times is measured once. The lookup is confined to
 * `publicRoot`: relative paths, `..` segments, symlinks that escape the folder,
 * directories, unreadable files and non-images all yield `undefined`, which the
 * caller treats as "render a plain `<img>` instead".
 *
 * @param publicPath - URL path such as `"/images/design/spacing.png"`.
 * @param publicRoot - Folder the path is resolved against; overridable for tests.
 * @returns The width and height in pixels, or `undefined` if unavailable.
 */
export const readImageDimensions = cache(
  (publicPath: string, publicRoot: string = PUBLIC_ROOT): ImageDimensions | undefined => {
    if (!publicPath.startsWith("/") || publicPath.split("/").includes("..")) return undefined;
    try {
      const resolvedRoot = fs.realpathSync(path.resolve(publicRoot));
      // Build-time only (pages are prerendered): without the ignore, Turbopack traces the whole
      // project (.git included) into every page that renders an image.
      const file = fs.realpathSync(
        /*turbopackIgnore: true*/ path.resolve(resolvedRoot, `.${publicPath}`),
      );
      if (!file.startsWith(resolvedRoot + path.sep)) return undefined;
      if (!fs.statSync(file).isFile()) return undefined;
      const { width, height } = imageSize(fs.readFileSync(file));
      return width && height ? { width, height } : undefined;
    } catch {
      return undefined;
    }
  },
);
