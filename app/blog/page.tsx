/**
 * @file `/blog/`: the latest post as a boxed excerpt, then every post grouped by year.
 * Posts are `posts/<slug>.mdx` (see `lib/posts.ts`).
 */
import type { Metadata } from "next";
import { DottedLink } from "@/components/DottedLink";
import { Page } from "@/components/Page";
import { listPosts, postHref, postsByYear } from "@/lib/posts";

/** Page title, rendered through the layout's `%s - Zach` template. */
export const metadata: Metadata = { title: "Blog" };

/** Blog index page. */
export default function BlogPage() {
  const posts = listPosts();
  const [latest, ...rest] = posts;

  return (
    <Page
      title="Blog"
      footer={{ href: "/", label: "../", ariaLabel: "Back to home" }}
      pinFooterLink
      section="blog"
    >
      {latest === undefined ? (
        <p>No posts yet.</p>
      ) : (
        <>
          <article className="card featured-post">
            <p className="dim">
              Latest · {latest.date} · {latest.minutes} min
            </p>
            <h2>
              <DottedLink href={postHref(latest)}>{latest.title}</DottedLink>
            </h2>
            {latest.summary && <p>{latest.summary}</p>}
            {latest.tags.length > 0 && (
              <p className="chips">
                {latest.tags.map((tag) => (
                  <code key={tag}>{tag}</code>
                ))}
              </p>
            )}
          </article>
          {postsByYear(rest).map(({ year, posts: inYear }) => (
            <section key={year} className="block">
              <h2 className="rule">{year}</h2>
              <ul className="dated">
                {inYear.map((post) => (
                  <li key={post.slug}>
                    <span className="dim">{post.date.slice(5)}</span>
                    <DottedLink href={postHref(post)}>{post.title}</DottedLink>
                    {post.tags[0] && <code>{post.tags[0]}</code>}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </Page>
  );
}
