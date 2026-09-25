/**
 * @file Home page (`/`): the topics as a numbered list, newest-first style
 * (first topic gets the highest number), a `v` link to every sheet, and an
 * `Info` footer link.
 */
import { DottedLink } from "@/components/DottedLink";
import { NumberedList } from "@/components/NumberedList";
import { Page } from "@/components/Page";
import { SITE_TITLE } from "@/lib/site";
import { TOPICS, topicNumber } from "@/lib/topics";

/** Home page. */
export default function HomePage() {
  const items = TOPICS.map((topic) => ({
    number: topicNumber(topic.slug) ?? 0,
    href: `/${topic.slug}/`,
    label: topic.name,
  }));

  return (
    <Page title={SITE_TITLE} footer={{ href: "/info/", label: "Info" }}>
      <NumberedList items={items} />
      <p className="v">
        <DottedLink href="/sheets/" ariaLabel="All cheatsheets">
          v
        </DottedLink>
      </p>
    </Page>
  );
}
