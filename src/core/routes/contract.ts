import { contractOf } from "../contract.ts";
import { driftOf } from "../drift.ts";
import { patternViolations } from "../patterns.ts";
import type { Handler } from "../types.ts";

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");
  if (req.method !== "GET" || (url.pathname !== "/contract" && url.pathname !== "/patterns" && url.pathname !== "/drift")) return false;
  const project = core.projects.get(url.searchParams.get("project") ?? "");
  // The Contract and the Differences are the "contract" plugin (src/plugins/contract): without it there are none.
  if (url.pathname !== "/patterns" && !core.plugins.active("contract")) core.send(res, 404, { error: "The Contract plugin is off" });
  else if (!project) core.send(res, 404, { error: "Unknown project: open it with POST /projects first" });
  // The drift list holds where the code differs from the Contract (see drift.ts); Pattern group violations and the drift list can be asked for alone.
  else if (url.pathname === "/patterns") core.send(res, 200, { violations: patternViolations(project) });
  else if (url.pathname === "/drift") core.send(res, 200, { drift: driftOf(project) });
  else core.send(res, 200, { ...contractOf(project.path), drift: driftOf(project) });
  return true;
};

export default handler;
