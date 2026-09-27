/**
 * @file `/resume/`: the resume from `lib/profile.ts`, in the PDF's order (education,
 * experience, projects, university activities, skills), with a link to the PDF itself.
 * Sections without entries are left out.
 */
import type { Metadata } from "next";
import { DottedLink } from "@/components/DottedLink";
import { Page } from "@/components/Page";
import { PROFILE, RESUME, listProjects } from "@/lib/profile";

/** Page title, rendered through the layout's `%s - Zach` template. */
export const metadata: Metadata = { title: "Resume" };

/** `Oct 2024 – Present`, or a single term when start and end are the same. */
function span(start: string, end: string): string {
  return start === end ? start : `${start} – ${end}`;
}

/** Resume page. */
export default function ResumePage() {
  const projects = listProjects();
  const { tools, languages } = RESUME.skills;

  return (
    <Page
      title="Resume"
      footer={{ href: "/", label: "../", ariaLabel: "Back to home" }}
      pinFooterLink
      section="resume"
      titleAside={
        <DottedLink href={RESUME.pdf} className="button">
          Download PDF
        </DottedLink>
      }
    >
      <p>
        {PROFILE.fullName} · {PROFILE.role}
        <br />
        <DottedLink href={PROFILE.github}>GitHub</DottedLink>
        <span className="dim"> · </span>
        <DottedLink href={PROFILE.linkedin}>LinkedIn</DottedLink>
      </p>

      {RESUME.education.length > 0 && (
        <section className="block">
          <h2 className="rule">Education</h2>
          {RESUME.education.map((item) => (
            <div key={item.school} className="entry">
              <p className="entry-head">
                <b>{item.school}</b>
                <span className="dim">{item.date}</span>
              </p>
              <p>
                {item.degree}
                {item.note && <span className="dim"> · {item.note}</span>}
              </p>
            </div>
          ))}
        </section>
      )}

      {RESUME.jobs.length > 0 && (
        <section className="block">
          <h2 className="rule">Experience</h2>
          {RESUME.jobs.map((job) => (
            <div key={`${job.company}-${job.role}`} className="entry">
              <p className="entry-head">
                <span>
                  <b>{job.role}</b> · {job.company}
                </span>
                <span className="dim">{span(job.start, job.end)}</span>
              </p>
              <ul>
                {job.points.map((point) => (
                  <li key={point}>{point}</li>
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
                  {project.href ? (
                    <DottedLink href={project.href} prefetch={false}>
                      {project.name}
                    </DottedLink>
                  ) : (
                    project.name
                  )}
                </b>
                {project.year && <span className="dim">{project.year}</span>}
              </p>
              <p>{project.description}</p>
            </div>
          ))}
        </section>
      )}

      {RESUME.activities.length > 0 && (
        <section className="block">
          <h2 className="rule">University activities</h2>
          {RESUME.activities.map((item) => (
            <div key={item.name} className="entry">
              <p className="entry-head">
                <span>
                  <b>{item.name}</b> · {item.role}
                </span>
                <span className="dim">{span(item.start, item.end)}</span>
              </p>
              <p>{item.summary}</p>
            </div>
          ))}
        </section>
      )}

      {(tools.length > 0 || languages.length > 0) && (
        <section className="block">
          <h2 className="rule">Skills</h2>
          <div className="skills">
            {languages.length > 0 && (
              <>
                <span className="dim">Languages</span>
                <p className="chips">
                  {languages.map((item) => (
                    <code key={item}>{item}</code>
                  ))}
                </p>
              </>
            )}
            {tools.length > 0 && (
              <>
                <span className="dim">Tools</span>
                <p className="chips">
                  {tools.map((item) => (
                    <code key={item}>{item}</code>
                  ))}
                </p>
              </>
            )}
          </div>
        </section>
      )}
    </Page>
  );
}
