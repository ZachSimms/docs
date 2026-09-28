/**
 * @file Tool: the choices the playground's exercise generator offers. Imports the site's own
 * option lists through the `@/` alias, to check that agent code can reuse `lib/`.
 */
import { defineTool } from "eve/tools";
import { z } from "zod";
import { CODE_LANGUAGES, DIFFICULTIES, MATH_AREAS, SIZES } from "@/lib/exercises/options";

export default defineTool({
  description:
    "List the languages, difficulties, sizes and math areas the playground can generate exercises for.",
  inputSchema: z.object({}),
  async execute() {
    return {
      languages: CODE_LANGUAGES.map((l) => l.id),
      difficulties: DIFFICULTIES.map((d) => d.id),
      sizes: SIZES.map((s) => s.id),
      mathAreas: MATH_AREAS.map((a) => a.id),
    };
  },
});
