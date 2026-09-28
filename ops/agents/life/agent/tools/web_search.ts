/**
 * @file No direct web access for the agent that holds personal data: untrusted pages reach it
 * only as intel's reports.
 */
import { disableTool } from "eve/tools";

export default disableTool();
