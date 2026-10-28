// The Plan for a Project, for the Tutor column: GET /tutor/plan?project= returns {plan, covered}.
// There is no write route: only the Teacher changes the Plan, when the person asks for it in the conversation.
import { coveredOf } from "../plan.ts";
import type { Handler } from "../types.ts";

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");
  if (req.method !== "GET" || url.pathname !== "/tutor/plan") return false;
  const project = url.searchParams.get("project");
  if (!project || !core.projects.has(project)) core.send(res, 400, { error: "project must be a Project that is already open" });
  else {
    const plan = core.plans.get(project) ?? null;
    core.send(res, 200, { plan, covered: plan ? coveredOf(core, plan) : [] });
  }
  return true;
};

export default handler;
