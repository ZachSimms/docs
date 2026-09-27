/**
 * @file `/blog/[slug]/`: one post, `posts/<slug>.mdx`, rendered like a sheet (same
 * typography, components and table of contents).
 *
 * The dynamic `import()` is safe only because the slug is validated against the
 * known posts first and `dynamicParams` is `false`.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { SheetView } from "@/components/SheetView";
import { getPost, listPosts, readPostBody } from "@/lib/posts";
import { extractToc } from "@/lib/toc";

/** Route params, delivered as a promise in the App Router. */
interface PostParams {
  params: Promise<{ slug: string }>;
}

/** Unknown posts 404 instead of rendering on demand. */
export const dynamicParams = false;

/** Prerender every post. */
export function generateStaticParams() {
  return listPosts().map((post) => ({ slug: post.slug }));
}

/** `<title>` is the post's title. */
export async function generateMetadata({ params }: PostParams): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  return post ? { title: post.title, description: post.summary } : { title: "Not found" };
}

/**
 * Import the compiled MDX module `posts/<slug>.mdx`.
 *
 * @returns The MDX component, or `undefined` if the module does not exist.
 */
async function loadPost(slug: string): Promise<ComponentType | undefined> {
  try {
    const mod = (await import(`@/posts/${slug}.mdx`)) as { default: ComponentType };
    return mod.default;
  } catch {
    return undefined;
  }
}

/** Post page; `../` returns to the blog. */
export default async function PostPage({ params }: PostParams) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();
  const Body = await loadPost(slug);
  if (!Body) notFound();

  return (
    <SheetView
      title={post.title}
      date={post.date}
      back={{ href: "/blog/", label: "../", ariaLabel: "Back to blog" }}
      toc={extractToc(readPostBody(slug))}
      section="blog"
      crumbs={[{ label: "blog", href: "/blog/" }, { label: slug }]}
    >
      <Body />
    </SheetView>
  );
}
