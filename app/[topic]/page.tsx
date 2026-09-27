/**
 * @file `/[topic]/`: one topic with every directory unfolded. Each directory is a
 * section headed by its own link and listing its sheets; loose sheets keep their
 * place in the topic's order.
 * Numbers match the topic's list (directories and loose sheets from `00.`) and,
 * inside a directory, the directory's own list.
 *
 * Statically generated for every entry in `TOPICS`; other segments 404 because
 * `dynamicParams` is `false`.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Page } from "@/components/Page";
import { TopicIndex, type TopicIndexEntry } from "@/components/TopicIndex";
import { groupHref, listGroupSheets, listTopicEntries, sheetHref } from "@/lib/content";
import { TOPICS, getTopic } from "@/lib/topics";

/** Route params, delivered as a promise in the App Router. */
interface TopicParams {
  params: Promise<{ topic: string }>;
}

/** Unknown topics 404 instead of rendering on demand. */
export const dynamicParams = false;

/** Prerender one page per topic. */
export function generateStaticParams() {
  return TOPICS.map((topic) => ({ topic: topic.slug }));
}

/** `<title>` is the topic name, e.g. "Physics - Zach". */
export async function generateMetadata({ params }: TopicParams): Promise<Metadata> {
  const { topic } = await params;
  return { title: getTopic(topic)?.name ?? "Not found" };
}

/** Topic index page. */
export default async function TopicPage({ params }: TopicParams) {
  const { topic: slug } = await params;
  const topic = getTopic(slug);
  if (!topic) notFound();

  const entries: TopicIndexEntry[] = listTopicEntries(topic.slug).map((entry) =>
    entry.kind === "group"
      ? {
          kind: "folder",
          folder: {
            heading: { number: entry.number, href: groupHref(entry), label: `${entry.title}/` },
            sheets: listGroupSheets(topic.slug, entry.slug).map((sheet) => ({
              number: sheet.number,
              href: sheetHref(sheet),
              label: sheet.title,
            })),
          },
        }
      : {
          kind: "sheet",
          sheet: { number: entry.number, href: sheetHref(entry), label: entry.title },
        },
  );
  const folders = entries.filter((entry) => entry.kind === "folder").length;
  const total = entries.reduce(
    (sum, entry) => sum + (entry.kind === "folder" ? entry.folder.sheets.length : 1),
    0,
  );

  return (
    <Page
      title={topic.name}
      footer={{ href: "/docs/", label: "../", ariaLabel: "Back to docs" }}
      pinFooterLink
      section="docs"
      docs={{ topic: topic.slug }}
      crumbs={[{ label: "docs", href: "/docs/" }, { label: topic.slug }]}
    >
      <p className="dim page-meta">
        {total} {total === 1 ? "sheet" : "sheets"}
        {folders > 0 && ` · ${folders} ${folders === 1 ? "folder" : "folders"}`}
      </p>
      <TopicIndex entries={entries} />
    </Page>
  );
}
