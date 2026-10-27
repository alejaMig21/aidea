import { loadAuthored } from "../authored.ts";
import type { Handler } from "../types.ts";

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");
  if (req.method !== "GET" || url.pathname !== "/authored") return false;
  const id = url.searchParams.get("project");
  if (!id) {
    core.send(res, 400, { error: "Missing query parameter: project" });
    return true;
  }
  const project = core.projects.get(id);
  if (!project) {
    core.send(res, 404, { error: "Unknown project: open it with POST /projects first" });
    return true;
  }
  core.send(res, 200, loadAuthored(project.path));
  return true;
};

export default handler;
