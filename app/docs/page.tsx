/**
 * @file `/docs/`: every topic as a card (number and sheet count), then the most
 * recently added sheets and a link to the full list.
 */
import type { Metadata } from "next";
import { BreakablePath } from "@/components/BreakablePath";
import { DottedLink } from "@/components/DottedLink";
import { Page } from "@/components/Page";
import { TopicCards } from "@/components/TopicCards";
import { listAllSheets, recentSheets, sheetHref } from "@/lib/content";
import { docsStats } from "@/lib/profile";
import { docPath } from "@/lib/search-rank";
import { TOPICS, topicNumber } from "@/lib/topics";

/** Page title, rendered through the layout's `%s - Zach` template. */
export const metadata: Metadata = { title: "Docs" };

/** How many recent sheets to list. */
const RECENT = 5;

/** Docs index page. */
export default function DocsPage() {
  const { sheets, topics } = docsStats();
  const cards = TOPICS.map((topic) => ({
    href: `/${topic.slug}/`,
    name: topic.name,
    number: topicNumber(topic.slug) ?? 0,
    count: listAllSheets([topic.slug]).length,
  }));

  return (
    <Page
      title="Docs"
      footer={{ href: "/", label: "../", ariaLabel: "Back to home" }}
      pinFooterLink
      section="docs"
    >
      <p>
        {sheets} cheatsheets across {topics} topics. Search any of them with <kbd>⌘K</kbd> or{" "}
        <kbd>/</kbd>.
      </p>
      <TopicCards cards={cards} />
      <section className="block">
        <h2 className="rule">Recently added</h2>
        <ul className="dated">
          {recentSheets(RECENT).map((sheet) => {
            const href = sheetHref(sheet);
            return (
              <li key={href}>
                <span className="dim">{sheet.date}</span>
                <DottedLink href={href} prefetch={false}>
                  <BreakablePath label={docPath({ url: href })} />
                </DottedLink>
              </li>
            );
          })}
        </ul>
        <p>
          <DottedLink href="/sheets/">All {sheets} sheets</DottedLink>
        </p>
      </section>
    </Page>
  );
}
