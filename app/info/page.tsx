/**
 * @file `/info/`: a short description of the site, a link to every sheet and
 * the keyboard shortcuts.
 */
import type { Metadata } from "next";
import { Fragment } from "react";
import { DottedLink } from "@/components/DottedLink";
import { Page } from "@/components/Page";
import { SHORTCUT_LIST } from "@/lib/keys";
import { SITE_TITLE } from "@/lib/site";

/** Page title, rendered through the layout's `%s - Zach` template. */
export const metadata: Metadata = { title: "Info" };

/** Column the actions start at, so they line up on the monospace grid. */
const KEY_WIDTH = 8;

/** Info page. */
export default function InfoPage() {
  return (
    <Page
      title={SITE_TITLE}
      footer={{ href: "/", label: "../", ariaLabel: "Back to home" }}
      pinFooterLink
    >
      <p>
        My personal reference hub.
        <br />
        Physics, biology, ML/AI, Python, C++,
        <br />
        TypeScript, robotics, writing, design and more.
      </p>
      <p>A Life Worth Living:</p>
      <ul>
        <li>Do hard things</li>
        <li>Look good, feel good</li>
        <li>Sisu (n): Strength of will in the face of adversity; grit, perseverance or determination</li>
        <li>Discipline is freedom (Jocko)</li>
        <li>Chop wood, carry water</li>
        <li>A game is fun when you play it, not when it ends</li>
        <li>Go where the &quot;hard way&quot; is the only way (Leila Hormozi)</li>
        <li>&quot;..this is what we do now&quot;</li>
        <li>All that matters is the man in the arena</li>
        <li>NEVER stop learning</li>
        <li>No one is coming to save you</li>
      </ul>
      <p>Quotes:</p>
      <ul>
        <li>&quot;Road to heaven feels like hell and the road to hell feels like heaven.&quot; - YT Comment</li>
        <li>&quot;...and those who were seen dancing were thought to be insane by those who could not hear the music &quot; - Friedrich Nietzsche</li>
        <li>&quot;Nothing changes if nothing changes&quot; - Theo Von</li>
        <li>&quot;The devil doesn&apos;t come dressed in a red cape with pointed horns. He comes as everything you&apos;ve ever wished for.&quot; - Theo Von</li>
        <li>&quot;Do not fear death, but rather the unlived life. You don&apos;t have to live forever. You just have to live.&quot; - Natalie Babbitt</li>
        <li>&quot;And if you gaze long into an abyss, the abyss also gazes into you.&quot; - Friedrich Nietzsche</li>
        <li>&quot;A ship is always safe at the shore, but that is not what it is built for.&quot; - Albert Einstein</li>
      </ul>
      <p>The Inspiration:</p>
      <ul>
        <li>Kobe Bryant</li>
        <li>Viktor Frankl</li>
        <li>Jocko Willink</li>
        <li>Elon Musk</li>
        <li>Micael Jordan</li>
        <li>Steve Jobs</li>
        <li>DJ Shipley</li>
        <li>Richard Feyynman</li>
        <li>Cam Hanes</li>
        <li>Marcus Aurelius</li>
        <li>David Goggins</li>
        <li>Mike Tyson</li>
        <li>Chris Bumstead</li>
        <li>Alex and Leila Hormozi</li>
        <li>Robert F. Smith</li>
        <li>Denzel Washington</li>
        <li>Theo Von</li>
        <li>Tom Brady</li>
        <li>Thomas Shelby</li>
        <li>Matthew McConaughey</li>
        <li>Admiral William H. McRaven</li>
      </ul>

      <p>-</p>
      <p>
        {">"} <DottedLink href="/sheets/">Cheatsheets</DottedLink>
      </p>
      <p>-</p>
      <p className="keys">
        {SHORTCUT_LIST.map(([keys, action]) => (
          <Fragment key={keys}>
            <kbd>{keys}</kbd>
            {" ".repeat(KEY_WIDTH - keys.length)}
            {action}
            <br />
          </Fragment>
        ))}
      </p>
    </Page>
  );
}
