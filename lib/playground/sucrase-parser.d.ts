/**
 * @file Types for the Sucrase parser entry points `loop-guard.ts` imports.
 *
 * Sucrase ships its declarations under `dist/types/`, which TypeScript doesn't
 * find for deep imports of `dist/esm/`; these re-export them.
 */

declare module "sucrase/dist/esm/parser" {
  export { parse } from "sucrase/dist/types/parser";
}

declare module "sucrase/dist/esm/parser/tokenizer/types" {
  export { TokenType } from "sucrase/dist/types/parser/tokenizer/types";
}
