/**
 * @file Who may reach the intel agent: this Vercel project (including the life agent, a
 * workspace peer) and local `eve dev`. Fails closed for everyone else.
 */
import { eveChannel } from "eve/channels/eve";
import { localDev, vercelOidc } from "eve/channels/auth";

export default eveChannel({
  auth: [vercelOidc(), localDev()],
});
