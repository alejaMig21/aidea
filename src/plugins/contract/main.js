// The Contract plugin, host half. The Contract is a summary computed from the layers the person accepted (src/core/contract.ts) and the Differences compare it with the code
// (src/core/drift.ts); nothing is stored here. It offers the Builders the tool `read_contract`, the interface half its data, and the Tutor a view and checks (teach.mjs).
import { contractOf } from "../../core/contract.ts";
import { driftOf } from "../../core/drift.ts";

export function activate(ctx) {
  const whole = (id) => {
    const project = ctx.projects.get(id);
    if (!project) throw new Error("The Project is not open");
    return { ...contractOf(project.path), drift: driftOf(project) };
  };

  ctx.agents.tools.add({
    name: "read_contract",
    description: "Returns the Contract: what the person accepted on the Business, Requirements and Architecture layers (pending Proposals are not in it). Read it before you build, and follow it.",
    inputSchema: { type: "object", properties: {} },
    readOnly: true, // Plan mode asks for any tool that does not say it only reads
    builders: true, // the Tutor reads this plugin through its view and checks, not through this tool
    run: (_input, { project } = {}) => {
      const path = ctx.projects.path(project);
      if (!path) throw new Error("The Project is not open");
      return contractOf(path).layers;
    },
  });

  ctx.api.handle("contract", ({ project }) => whole(project));
  ctx.teach.state(({ project } = {}) => {
    try { return project ? whole(project) : { readiness: [], drift: [] }; } catch { return { readiness: [], drift: [] }; }
  });
}
