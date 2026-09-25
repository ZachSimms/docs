/**
 * @file `/[topic]/[slug]/[sheet]/`: a cheatsheet inside a directory,
 * `content/<topic>/<slug>/<sheet>.mdx`.
 *
 * As in the parent route, the dynamic `import()` is safe only because every
 * param is validated (known topic, known directory, kebab-case sheet) first and
 * `dynamicParams` is `false`.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { SheetView } from "@/components/SheetView";
import { getGroupSheetMeta, groupHref, listAllSheets, readSheetBody } from "@/lib/content";
import { extractToc } from "@/lib/toc";
import { getTopic } from "@/lib/topics";

/** Route params, delivered as a promise in the App Router. */
interface GroupSheetParams {
  params: Promise<{ topic: string; slug: string; sheet: string }>;
}

/** Unknown sheets 404 instead of rendering on demand. */
export const dynamicParams = false;

/** Prerender every sheet that lives inside a directory. */
export function generateStaticParams() {
  return listAllSheets().flatMap((sheet) =>
    sheet.group === undefined ? [] : [{ topic: sheet.topic, slug: sheet.group, sheet: sheet.slug }],
  );
}

/** `<title>` is the sheet's frontmatter title, e.g. "Array methods - Zach". */
export async function generateMetadata({ params }: GroupSheetParams): Promise<Metadata> {
  const { topic, slug, sheet } = await params;
  if (!getTopic(topic)) return { title: "Not found" };
  return { title: getGroupSheetMeta(topic, slug, sheet)?.title ?? "Not found" };
}

/**
 * Import the compiled MDX module `content/<topic>/<group>/<sheet>.mdx`.
 *
 * @returns The MDX component, or `undefined` if the module does not exist.
 */
async function loadSheet(
  topic: string,
  group: string,
  sheet: string,
): Promise<ComponentType | undefined> {
  try {
    const mod = (await import(`@/content/${topic}/${group}/${sheet}.mdx`)) as {
      default: ComponentType;
    };
    return mod.default;
  } catch {
    return undefined;
  }
}

/** Cheatsheet page for a sheet inside a directory; `../` returns to the directory. */
export default async function GroupSheetPage({ params }: GroupSheetParams) {
  const { topic, slug, sheet } = await params;
  if (!getTopic(topic)) notFound();
  const meta = getGroupSheetMeta(topic, slug, sheet);
  if (!meta) notFound();

  const Sheet = await loadSheet(topic, slug, sheet);
  if (!Sheet) notFound();

  return (
    <SheetView
      title={meta.title}
      date={meta.date}
      back={{ href: groupHref({ topic, slug }), label: "../", ariaLabel: "Back to directory" }}
      toc={extractToc(readSheetBody(meta))}
    >
      <Sheet />
    </SheetView>
  );
}
