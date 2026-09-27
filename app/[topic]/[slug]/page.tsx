/**
 * @file `/[topic]/[slug]/`: either a loose cheatsheet or a directory page.
 *
 * A directory (`content/<topic>/<slug>/`) renders its `index.mdx` intro and a
 * numbered list of its sheets; anything else is a single sheet.
 *
 * The MDX modules are loaded with dynamic `import()`s whose paths are built
 * from the route params; that is safe only because both params are validated
 * against the known topics and the kebab-case segment pattern first, and
 * because `dynamicParams` is `false` so only prerendered paths exist.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { NumberedList } from "@/components/NumberedList";
import { Page } from "@/components/Page";
import { SheetView } from "@/components/SheetView";
import {
  getGroupMeta,
  getSheetMeta,
  listAllGroups,
  listAllSheets,
  listGroupSheets,
  readSheetBody,
  sheetHref,
  type Group,
} from "@/lib/content";
import { extractToc } from "@/lib/toc";
import { getTopic } from "@/lib/topics";

/** Route params, delivered as a promise in the App Router. */
interface SlugParams {
  params: Promise<{ topic: string; slug: string }>;
}

/** Unknown sheets and directories 404 instead of rendering on demand. */
export const dynamicParams = false;

/** Prerender every loose sheet and every directory found under `content/`. */
export function generateStaticParams() {
  const sheets = listAllSheets()
    .filter((sheet) => sheet.group === undefined)
    .map((sheet) => ({ topic: sheet.topic, slug: sheet.slug }));
  const groups = listAllGroups().map((group) => ({ topic: group.topic, slug: group.slug }));
  return [...groups, ...sheets];
}

/** `<title>` is the directory's or sheet's title, e.g. "Language - Zach". */
export async function generateMetadata({ params }: SlugParams): Promise<Metadata> {
  const { topic, slug } = await params;
  if (!getTopic(topic)) return { title: "Not found" };
  const title = getGroupMeta(topic, slug)?.title ?? getSheetMeta(topic, slug)?.title;
  return { title: title ?? "Not found" };
}

/**
 * Import a compiled MDX module from `content/<topic>/<slug>.mdx`.
 *
 * @returns The MDX component, or `undefined` if the module does not exist
 *   (which the page turns into a 404 rather than a 500).
 */
async function loadSheet(topic: string, slug: string): Promise<ComponentType | undefined> {
  try {
    const mod = (await import(`@/content/${topic}/${slug}.mdx`)) as { default: ComponentType };
    return mod.default;
  } catch {
    return undefined;
  }
}

/**
 * Import a directory's `content/<topic>/<slug>/index.mdx`. The loader already
 * guarantees the file exists, so any error here is a real one and fails the build.
 */
async function loadGroupIndex(topic: string, slug: string): Promise<ComponentType> {
  const mod = (await import(`@/content/${topic}/${slug}/index.mdx`)) as { default: ComponentType };
  return mod.default;
}

/** Directory page: the `index.mdx` intro, then the directory's sheets as a numbered list. */
async function GroupPage({ group }: { group: Group }) {
  const Intro = await loadGroupIndex(group.topic, group.slug);
  const items = listGroupSheets(group.topic, group.slug).map((sheet) => ({
    number: sheet.number,
    href: sheetHref(sheet),
    label: sheet.title,
  }));

  return (
    <Page
      title={group.title}
      footer={{ href: `/${group.topic}/`, label: "../", ariaLabel: "Back to topic" }}
      pinFooterLink
      section="docs"
      docs={{ topic: group.topic, group: group.slug }}
      crumbs={[
        { label: "docs", href: "/docs/" },
        { label: group.topic, href: `/${group.topic}/` },
        { label: group.slug },
      ]}
    >
      <Intro />
      <NumberedList items={items} />
    </Page>
  );
}

/** A loose sheet or a directory, depending on what `content/<topic>/<slug>` is. */
export default async function SlugPage({ params }: SlugParams) {
  const { topic, slug } = await params;
  if (!getTopic(topic)) notFound();

  const group = getGroupMeta(topic, slug);
  if (group) return <GroupPage group={group} />;

  const meta = getSheetMeta(topic, slug);
  if (!meta) notFound();
  const Sheet = await loadSheet(topic, slug);
  if (!Sheet) notFound();

  return (
    <SheetView
      title={meta.title}
      date={meta.date}
      back={{ href: `/${topic}/`, label: "../", ariaLabel: "Back to topic" }}
      toc={extractToc(readSheetBody(meta))}
      docs={{ topic, sheet: slug }}
      crumbs={[
        { label: "docs", href: "/docs/" },
        { label: topic, href: `/${topic}/` },
        { label: slug },
      ]}
    >
      <Sheet />
    </SheetView>
  );
}
