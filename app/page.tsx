/**
 * @file Home page (`/`): a single column without the side navigation. The name, the
 * introduction and the sections with their shortcut keys, beside a dithered sky:
 * tonight's moon, or the sun in the dark theme (`d` switches).
 */
import { HomeKeys } from "@/components/HomeKeys";
import { Page } from "@/components/Page";
import { SkyFigure } from "@/components/SkyFigure";
import { PROFILE } from "@/lib/profile";

/** Home page. */
export default function HomePage() {
  return (
    <Page
      title={PROFILE.fullName}
      footer={{ href: "/info/", label: "Info" }}
      secondaryFooter={{ href: "/playground/", label: "Playground" }}
      section="home"
      layout="solo"
      titleAside={<SkyFigure />}
    >
      <p>{PROFILE.bio}</p>
      <HomeKeys />
    </Page>
  );
}
