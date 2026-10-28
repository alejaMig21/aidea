import { contractOf } from "../contract.ts";
import type { Handler } from "../types.ts";

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");
  if (req.method !== "GET" || url.pathname !== "/contract") return false;
  const project = core.projects.get(url.searchParams.get("project") ?? "");
  if (!project) core.send(res, 404, { error: "Unknown project: open it with POST /projects first" });
  else core.send(res, 200, contractOf(project.path));
  return true;
};

export default handler;
