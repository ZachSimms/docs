// Must run before anything imports @testing-library/* (ESM imports are hoisted).
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// A real origin so next/image and URL-relative code behave as in a browser.
// Iframes (the <YouTube> embed) never load their pages: tests stay offline.
GlobalRegistrator.register({
  url: "http://localhost:3000/",
  settings: { navigation: { disableChildFrameNavigation: true } },
});
