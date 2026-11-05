// The stored measurement of a Project: GET /tutor/measure?project= returns {result} (null when the Tutor has not measured yet).
// The measurement itself happens inside the Tutor's session, with its measure and measure_done tools (measure.ts, teach.ts).
import type { Core, Handler } from "../types.ts";

const handler: Handler = async (req, res, core: Core) => {
  const url = new URL(req.url ?? "/", "http://core");
  if (req.method !== "GET" || url.pathname !== "/tutor/measure") return false;
  const project = url.searchParams.get("project");
  if (!project || !core.projects.has(project)) {
    core.send(res, 400, { error: "project must be a Project that is already open" });
    return true;
  }
  core.send(res, 200, { result: core.measures.get(project) ?? null });
  return true;
};

export default handler;
