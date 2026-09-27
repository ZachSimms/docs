/**
 * @file `/sheets/`: every cheatsheet across all topics, in display order, listed as
 * `NN. topic/slug` (or `NN. topic/directory/slug`) and numbered globally.
 */
import type { Metadata } from "next";
import { NumberedList } from "@/components/NumberedList";
import { Page } from "@/components/Page";
import { listAllSheets, sheetHref } from "@/lib/content";
import { docPath } from "@/lib/search-rank";

/** Page title, rendered through the layout's `%s - Zach` template. */
export const metadata: Metadata = { title: "Cheatsheets" };

/** All-sheets index page. */
export default function SheetsPage() {
  const items = listAllSheets().map((sheet) => ({
    number: sheet.number,
    href: sheetHref(sheet),
    label: docPath({ url: sheetHref(sheet) }),
  }));

  return (
    <Page
      title="Cheatsheets"
      footer={{ href: "/docs/", label: "../", ariaLabel: "Back to docs" }}
      pinFooterLink
      section="docs"
      docs={{}}
      crumbs={[{ label: "docs", href: "/docs/" }, { label: "sheets" }]}
    >
      <NumberedList items={items} />
    </Page>
  );
}
