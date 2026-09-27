/**
 * @file Home page (`/`): a single column without the side navigation. The name, the
 * introduction, a dither block, the sections with their shortcut keys, and a footer
 * with the theme hint.
 */
import { DitherBlock } from "@/components/DitherBlock";
import { HomeKeys } from "@/components/HomeKeys";
import { Page } from "@/components/Page";
import { ThemeHint } from "@/components/ThemeHint";
import { listPosts } from "@/lib/posts";
import { PROFILE, RESUME } from "@/lib/profile";
import { TOPICS } from "@/lib/topics";

/** Home page. */
export default function HomePage() {
  const posts = listPosts();
  const job = RESUME.jobs[0];

  return (
    <Page
      title={PROFILE.fullName}
      footer={{ href: "/info/", label: "Info" }}
      secondaryFooter={{ href: "/playground/", label: "Playground" }}
      section="home"
      layout="solo"
      footerAside={<ThemeHint />}
    >
      <p>{PROFILE.bio}</p>
      <DitherBlock />
      <HomeKeys
        notes={{
          p: PROFILE.projectsNote,
          r: job ? `${job.shortName ?? job.company} since ${job.start}` : "",
          b: posts[0] ? `latest: ${posts[0].title}` : "no posts yet",
          g: `${TOPICS.length} topics`,
        }}
      />
    </Page>
  );
}
