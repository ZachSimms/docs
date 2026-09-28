/**
 * @file Who may reach the life agent. Fails closed: callers from this Vercel project (eve's
 * own runtime and workspace peers) and local `eve dev`, nobody else. Add the owner's
 * sign-in ahead of these before exposing a browser UI.
 */
import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [vercelOidc(), localDev()],
});
