// The person's side of Proposals: see what is pending, accept or reject it.
import { apply, withPlaces } from "../proposals.ts";
import type { Handler } from "../types.ts";

const handler: Handler = async (req, res, core) => {
  const url = new URL(req.url ?? "/", "http://core");

  if (req.method === "GET" && url.pathname === "/proposals") {
    const project = core.projects.get(url.searchParams.get("project") ?? "");
    if (!project) {
      core.send(res, 404, { error: "Unknown project: open it with POST /projects first" });
      return true;
    }
    core.send(res, 200, { proposals: withPlaces(core.proposals, project) });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/proposals/answer") {
    const body = (await core.readJson(req, res)) as Record<string, unknown> | null | undefined;
    if (body === undefined) return true; // readJson already answered
    const { id, secret, decision } = body ?? {};
    if (typeof id !== "string" || typeof secret !== "string" || (decision !== "accept" && decision !== "reject")) {
      core.send(res, 400, { error: 'Send an id, the secret from the proposal and a decision of "accept" or "reject"' });
      return true;
    }
    const proposal = core.proposals.get(id);
    if (!proposal || proposal.status !== "pending") {
      core.send(res, 404, { error: "Unknown proposal, or it was already decided" });
      return true;
    }
    if (secret !== proposal.secret) {
      core.send(res, 403, { error: "That secret does not belong to this proposal" });
      return true;
    }
    if (decision === "accept") {
      const project = core.projects.get(proposal.project);
      const problem = project ? apply(project, proposal) : "The Project is not open";
      if (problem) {
        core.send(res, 409, { error: problem }); // it stays pending: the person can reject it
        return true;
      }
    }
    proposal.status = decision === "accept" ? "accepted" : "rejected";
    core.send(res, 200, { ok: true });
    return true;
  }
  return false;
};

export default handler;
