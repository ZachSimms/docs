/**
 * @file `/source/<path>.md`: the MDX source of a sheet, a directory's intro or a post,
 * as plain text for the terminal's `md` pane (and anyone who wants the Markdown).
 *
 * Every file is prerendered at build time; `dynamicParams = false` means no other path
 * is ever served, so nothing outside the listed sources can be read.
 */
import { listSources, readSource } from "@/lib/terminal/source";

/** Prerender at build time; never run per request. */
export const dynamic = "force-static";

/** Only the prerendered sources exist. */
export const dynamicParams = false;

/** One file per source (see `lib/terminal/source.ts`). */
export function generateStaticParams(): { path: string[] }[] {
  return listSources().map((source) => ({ path: [...source.segments] }));
}

/** The source as `text/markdown`, or a 404. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await params;
  const text = readSource(path);
  if (text === undefined) return new Response("Not found", { status: 404 });
  return new Response(text, { headers: { "content-type": "text/markdown; charset=utf-8" } });
}
