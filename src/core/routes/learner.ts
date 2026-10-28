// The Learner: what has been recorded, and the retry of a class whose pipeline failed. There is no edit route:
// an idea can only be deleted (with the chains that use it).
import type { Handler } from "../types.ts";

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");
  const path = url.pathname;

  if (req.method === "GET" && path === "/learner/graph") {
    core.send(res, 200, core.learner.graph());
    return true;
  }
  if (req.method === "GET" && path === "/learner/evidence") {
    core.send(res, 200, { entries: core.learner.evidence({ project: url.searchParams.get("project") ?? undefined, classId: url.searchParams.get("class") ?? undefined }) });
    return true;
  }
  const idea = path.match(/^\/learner\/propositions\/([^/]+)$/);
  if (req.method === "DELETE" && idea) {
    if (!core.learner.remove(decodeURIComponent(idea[1]))) core.send(res, 404, { error: "No such idea" });
    else core.send(res, 200, { ok: true });
    return true;
  }
  const close = path.match(/^\/tutor\/classes\/([^/]+)\/close$/);
  if (req.method === "POST" && close) {
    const outcome = await core.learner.retry(decodeURIComponent(close[1]));
    if (outcome === "unknown") core.send(res, 404, { error: "No class is waiting to be closed under that id" });
    else if (outcome === "busy") core.send(res, 409, { error: "That class is being closed right now" });
    else if (outcome.status === "failed") core.send(res, 502, { error: "pipeline failed", message: outcome.message });
    else core.send(res, 200, { ok: true, ideas: outcome.ideas });
    return true;
  }
  return false;
};

export default handler;
