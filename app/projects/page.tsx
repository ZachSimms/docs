/**
 * @file `/projects/`: every project as a card, newest first (see `lib/profile.ts`).
 */
import type { Metadata } from "next";
import { Page } from "@/components/Page";
import { ProjectCard } from "@/components/ProjectCard";
import { listProjects } from "@/lib/profile";

/** Page title, rendered through the layout's `%s - Zach` template. */
export const metadata: Metadata = { title: "Projects" };

/** Projects page. */
export default function ProjectsPage() {
  const projects = listProjects();
  return (
    <Page
      title="Projects"
      footer={{ href: "/", label: "../", ariaLabel: "Back to home" }}
      pinFooterLink
      section="projects"
    >
      <p className="dim page-meta">
        {projects.length} {projects.length === 1 ? "project" : "projects"}
      </p>
      <div className="card-grid">
        {projects.map((project) => (
          <ProjectCard key={project.name} project={project} />
        ))}
      </div>
    </Page>
  );
}
