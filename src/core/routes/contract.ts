import { contractOf } from "../contract.ts";
import { patternViolations } from "../patterns.ts";
import type { Handler } from "../types.ts";

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");
  if (req.method !== "GET" || (url.pathname !== "/contract" && url.pathname !== "/patterns")) return false;
  const project = core.projects.get(url.searchParams.get("project") ?? "");
  if (!project) core.send(res, 404, { error: "Unknown project: open it with POST /projects first" });
  // The drift list holds what the code does against the Contract; for now only Pattern group violations (they can be asked for alone).
  else if (url.pathname === "/patterns") core.send(res, 200, { violations: patternViolations(project) });
  else core.send(res, 200, { ...contractOf(project.path), drift: patternViolations(project) });
  return true;
};

export default handler;
