// Must run before anything imports @testing-library/* (ESM imports are hoisted).
import { GlobalRegistrator } from "@happy-dom/global-registrator";

// A real origin so next/image and URL-relative code behave as in a browser.
GlobalRegistrator.register({ url: "http://localhost:3000/" });
