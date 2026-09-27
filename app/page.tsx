/**
 * @file Home page (`/`): a single column without the side navigation. The name, the
 * introduction, the activity grid (commits, sheets and posts per day), the sections
 * with their shortcut keys, and a footer with the theme hint.
 *
 * Prerendered at build time, so the grid ends on the day of the last build.
 */
import { ActivityGrid } from "@/components/ActivityGrid";
import { HomeKeys } from "@/components/HomeKeys";
import { Page } from "@/components/Page";
import { ThemeHint } from "@/components/ThemeHint";
import { buildActivity, gitCommitDates } from "@/lib/activity";
import { listAllSheets } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { listPosts } from "@/lib/posts";
import { PROFILE, RESUME } from "@/lib/profile";
import { TOPICS } from "@/lib/topics";

/** Home page. */
export default function HomePage() {
  const posts = listPosts();
  const activity = buildActivity({
    today: formatDate(new Date()),
    commits: gitCommitDates(),
    sheets: listAllSheets().map((sheet) => sheet.date),
    posts: posts.map((post) => post.date),
  });
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
      <ActivityGrid activity={activity} />
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
