/**
 * @file 404 page in the house style. Reached for unknown routes and for topic
 * or sheet segments rejected by `dynamicParams = false`.
 */
import { Page } from "@/components/Page";

/** 404 page. */
export default function NotFound() {
  return (
    <Page title="404" footer={{ href: "/", label: "../", ariaLabel: "Back to home" }} pinFooterLink>
      <p>Not found.</p>
    </Page>
  );
}
