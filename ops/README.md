# ops: private agents

An [eve](https://eve.dev/docs) agent workspace, deployed as its **own Vercel project** (Root Directory
`ops`), separate from the public site at the repository root. The site's public agent lives in `/agent`
and deploys with the site; nothing here is mounted into it.

| Agent   | Route             | What it does                                                                              |
| ------- | ----------------- | ----------------------------------------------------------------------------------------- |
| `life`  | `/eve/life/v1/*`  | Personal assistant. No web access of its own; delegates research to `intel`.              |
| `intel` | `/eve/intel/v1/*` | Research desk: `collector` (web search and fetch), `synthesizer` and `analyst` subagents. |

`life` calls `intel` as a workspace peer (`agents/life/agent/subagents/intel.ts`); `intel` never calls
`life` and holds none of its connections. Both channels fail closed: only this Vercel project (eve's own
runtime and the peer call) and local `eve dev` get in, until an owner sign-in is added.

## Code public, data private

This repository is public. Everything under `ops/` is published, so it holds capabilities, never
personal facts: no names, accounts, addresses or preferences in instructions, tools or schedules.
Those belong in connections (OAuth through Vercel Connect), environment variables on the `ops` Vercel
project, and runtime storage. The `ops` project's environment variables are separate from the site's.

## Develop

Node.js 24; Bun installs and runs the scripts.

```bash
cd ops
bun install
bun run dev:intel   # intel on http://127.0.0.1:4311
bun run dev:life    # life; reaches intel at 127.0.0.1:4311 (or INTEL_AGENT_URL)
bun run typecheck
```

Model calls need AI Gateway credentials (`AI_GATEWAY_API_KEY` in `ops/.env.local`, or `vercel env pull`
once the project is linked).

## Deploy

Create a second Vercel project from this repository with **Root Directory** `ops` and Node.js 24.
`eve build` at this root writes the Build Output config: one service per agent (`eve-life`,
`eve-intel`), each built on its own. The Vercel Sandbox snapshot is created during that build, which needs
the project's OIDC token, so the first real build happens on Vercel. To stop pushes that only touch the
site from rebuilding this project (and the reverse), set each project's Ignored Build Step, for example
`git diff --quiet HEAD^ HEAD -- .` here.
