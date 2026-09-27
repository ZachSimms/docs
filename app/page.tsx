/**
 * @file Home page (`/`): the introduction, featured projects, the latest posts (when
 * there are any) and the most recently added sheets.
 */
import { BreakablePath } from "@/components/BreakablePath";
import { DottedLink } from "@/components/DottedLink";
import { Page } from "@/components/Page";
import { ProjectCard } from "@/components/ProjectCard";
import { recentSheets, sheetHref } from "@/lib/content";
import { listPosts, postHref } from "@/lib/posts";
import { PROFILE, docsStats, listProjects } from "@/lib/profile";
import { docPath } from "@/lib/search-rank";
import { SITE_TITLE } from "@/lib/site";

/** How many posts and sheets each list shows. */
const RECENT = 3;

/** Home page. */
export default function HomePage() {
  const projects = listProjects().filter((project) => project.featured);
  const posts = listPosts().slice(0, RECENT);
  const { sheets } = docsStats();

  return (
    <Page
      title={SITE_TITLE}
      footer={{ href: "/info/", label: "Info" }}
      secondaryFooter={{ href: "/playground/", label: "Playground" }}
      section="home"
    >
      <p>{PROFILE.bio}</p>
      <section className="block">
        <h2>Selected projects</h2>
        <div className="card-grid">
          {projects.map((project) => (
            <ProjectCard key={project.name} project={project} />
          ))}
        </div>
      </section>
      {posts.length > 0 && (
        <section className="block">
          <h2>Recent writing</h2>
          <ul className="dated">
            {posts.map((post) => (
              <li key={post.slug}>
                <span className="dim">{post.date}</span>
                <DottedLink href={postHref(post)}>{post.title}</DottedLink>
              </li>
            ))}
          </ul>
          <p>
            <DottedLink href="/blog/">All posts</DottedLink>
          </p>
        </section>
      )}
      <section className="block">
        <h2>Recently added to the docs</h2>
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
          <DottedLink href="/docs/">All {sheets} sheets</DottedLink>
        </p>
      </section>
    </Page>
  );
}
