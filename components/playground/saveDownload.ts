/**
 * @file Save bytes as a file in the browser (the file menu's Download).
 *
 * Client-only. A Blob, an object URL and a click on an `<a download>`; the URL
 * is revoked once the browser has taken the file.
 */

import type { Download } from "@/lib/playground/download";

/** How long to keep the object URL alive for the browser to start the download. */
const REVOKE_AFTER_MS = 30_000;

/** Start a download of `file`. */
export function saveDownload(file: Download): void {
  const url = URL.createObjectURL(new Blob([file.data as BlobPart], { type: file.type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_AFTER_MS);
}
