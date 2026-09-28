/**
 * @file `GET /api/exercises/status/`: what this deployment can see of the AI Gateway setup,
 * for diagnosing "isn't set up" errors. Booleans and names only: never a key or a token.
 */
import { modelConfig } from "@/lib/exercises/ai";

/** Per request: the answer depends on the request's headers and the live environment. */
export const dynamic = "force-dynamic";

/** Report the gateway configuration. */
export function GET(request: Request): Response {
  const env = process.env;
  const { model, fallbacks, reasoning } = modelConfig(env);
  const apiKey = Boolean(env.AI_GATEWAY_API_KEY?.trim());
  const oidc = Boolean(request.headers.get("x-vercel-oidc-token") || env.VERCEL_OIDC_TOKEN?.trim());
  return Response.json(
    {
      ready: apiKey || oidc,
      auth: apiKey ? "api-key" : oidc ? "oidc" : "none",
      apiKey,
      oidc,
      vercel: env.VERCEL === "1",
      vercelEnv: env.VERCEL_ENV ?? null,
      model,
      fallbacks,
      reasoning,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
