/**
 * @file One project as a boxed card: name, description, stack chips, links and year.
 * Used on `/projects/`.
 */

import type { Project } from "@/lib/profile";
import { DottedLink } from "./DottedLink";

/** Render `<article class="card">` for one project. */
export function ProjectCard({ project }: { project: Project }) {
  return (
    <article className="card project-card">
      <h3 className="card-head">
        <DottedLink href={project.href} prefetch={false}>
          {project.name}
        </DottedLink>
        <span className="dim">{project.year}</span>
      </h3>
      <p>{project.description}</p>
      <p className="chips">
        {project.stack.map((item) => (
          <code key={item}>{item}</code>
        ))}
      </p>
      {project.source && (
        <p>
          <DottedLink href={project.source}>source</DottedLink>
        </p>
      )}
    </article>
  );
}
