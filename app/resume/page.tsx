/**
 * @file `/resume/`: experience, projects, education and skills, from `lib/profile.ts`.
 * Sections without entries are left out; the PDF link shows only when a PDF is set.
 */
import type { Metadata } from "next";
import { DottedLink } from "@/components/DottedLink";
import { Page } from "@/components/Page";
import { PROFILE, RESUME, listProjects } from "@/lib/profile";

/** Page title, rendered through the layout's `%s - Zach` template. */
export const metadata: Metadata = { title: "Resume" };

/** Resume page. */
export default function ResumePage() {
  const projects = listProjects();
  return (
    <Page
      title="Resume"
      footer={{ href: "/", label: "../", ariaLabel: "Back to home" }}
      pinFooterLink
      section="resume"
      titleAside={
        RESUME.pdf && (
          <DottedLink href={RESUME.pdf} className="button">
            Download PDF
          </DottedLink>
        )
      }
    >
      <p>
        {PROFILE.fullName} · {PROFILE.role} · {PROFILE.location}
      </p>
      <p>{RESUME.summary}</p>

      {RESUME.jobs.length > 0 && (
        <section className="block">
          <h2 className="rule">Experience</h2>
          {RESUME.jobs.map((job, i) => (
            <div key={i} className="entry">
              <p className="entry-head">
                <span>
                  <b>{job.role}</b> · {job.company}
                </span>
                <span className="dim">
                  {job.start} – {job.end}
                </span>
              </p>
              <ul>
                {job.points.map((point, j) => (
                  <li key={j}>{point}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {projects.length > 0 && (
        <section className="block">
          <h2 className="rule">Projects</h2>
          {projects.map((project) => (
            <div key={project.name} className="entry">
              <p className="entry-head">
                <b>
                  <DottedLink href={project.href} prefetch={false}>
                    {project.name}
                  </DottedLink>
                </b>
                <span className="dim">{project.year}</span>
              </p>
              <p>{project.description}</p>
            </div>
          ))}
        </section>
      )}

      {RESUME.education.length > 0 && (
        <section className="block">
          <h2 className="rule">Education</h2>
          {RESUME.education.map((item, i) => (
            <p key={i} className="entry-head">
              <span>
                <b>{item.title}</b> · {item.school}
              </span>
              <span className="dim">{item.year}</span>
            </p>
          ))}
        </section>
      )}

      {RESUME.skills.length > 0 && (
        <section className="block">
          <h2 className="rule">Skills</h2>
          <p className="chips">
            {RESUME.skills.map((skill) => (
              <code key={skill}>{skill}</code>
            ))}
          </p>
        </section>
      )}
    </Page>
  );
}
