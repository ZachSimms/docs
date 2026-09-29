/**
 * @file Home page (`/`): a single column without the side navigation. The name, the
 * introduction and the sections with their shortcut keys, beside a dithered sky:
 * the Earth turning, and the Moon going round it.
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
