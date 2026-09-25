import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "bun:test";

expect.extend(matchers);
afterEach(() => cleanup());

// next/link reads this build-time flag; mirror `trailingSlash: true` from next.config.ts.
process.env.__NEXT_TRAILING_SLASH = "true";
