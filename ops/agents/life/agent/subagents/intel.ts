/**
 * @file Delegates research to the intel agent, a peer in this workspace. On Vercel (and under
 * `vercel dev`) eve routes the call itself and authenticates it with the project's OIDC token.
 * Elsewhere it goes to a separately running intel: `bun run dev:intel`, or `INTEL_AGENT_URL`.
 */
import { defineWorkspaceAgent } from "eve";

export default defineWorkspaceAgent({
  name: "intel",
  ...(process.env.VERCEL
    ? {}
    : { transport: { url: () => process.env.INTEL_AGENT_URL ?? "http://127.0.0.1:4311" } }),
});
