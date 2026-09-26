/**
 * @file `/[topic]/`: one topic's directories and loose cheatsheets, in display order,
 * numbered within the topic. Directories are labeled with a trailing `/`.
 *
 * Statically generated for every entry in `TOPICS`; other segments 404 because
 * `dynamicParams` is `false`.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NumberedList } from "@/components/NumberedList";
import { Page } from "@/components/Page";
import { groupHref, listTopicEntries, sheetHref } from "@/lib/content";
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

  const items = listTopicEntries(topic.slug).map((entry) =>
    entry.kind === "group"
      ? { number: entry.number, href: groupHref(entry), label: `${entry.title}/` }
      : { number: entry.number, href: sheetHref(entry), label: entry.title },
  );

  return (
    <Page
      title={topic.name}
      footer={{ href: "/", label: "../", ariaLabel: "Back to home" }}
      pinFooterLink
    >
      <NumberedList items={items} />
    </Page>
  );
}
