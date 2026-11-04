const fs = require("fs");
function edit(f, pairs) {
  let t = fs.readFileSync(f, "utf8"); const eol = t.includes("\r\n") ? "\r\n" : "\n";
  for (const [a, b] of pairs) { const A = a.replace(/\n/g, eol), B = b.replace(/\n/g, eol); if (!t.includes(A)) throw new Error("nf " + f + ": " + a.slice(0, 80)); t = t.replace(A, () => B); }
  fs.writeFileSync(f, t);
}
edit("src/core/routes/mcp.ts", [
  [`import { decisionTools, finishGate, holdIfBlocking, runDecisionTool } from "../decision-class.ts";\n`, ``],
  [`"This is a Blocking decision. Nothing changes until the person accepts it.",`, `"Nothing changes until the person accepts it.",`],
  [`...PLUGIN_READ_TOOLS, ...decisionTools(core.permissions.conversationOf(token)?.classId)] : prober`, `...PLUGIN_READ_TOOLS] : prober`],
  [`      const conversation = core.permissions.conversationOf(token);
      const decision = runDecisionTool(name, args, core, conversation?.classId, (e) => conversation?.emit(e));
      if (decision) {
        core.send(res, 200, toolText(id, decision.text, decision.isError));
        return true;
      }
      const gate = finishGate(core, name, conversation?.classId);
      if (gate) {
        core.send(res, 200, toolText(id, gate, true));
        return true;
      }
`, ``],
  [`      const held = holdIfBlocking(core, result.proposal);
      conversation.emit({ type: "proposal", ...publicView(result.proposal), secret: result.proposal.secret });
      if (held) conversation.emit({ type: "decision_class", proposal: result.proposal.id, project: project.id });
      core.send(res, 200, toolText(id, JSON.stringify({ proposal: result.proposal.id, status: held ? "waiting-for-class" : "pending", message: held ? "This is a Blocking decision: the person must first answer a short class about it. It cannot be accepted until then. Carry on with what does not depend on it." : "The person will review it. Nothing changes until they accept." })));`, `      conversation.emit({ type: "proposal", ...publicView(result.proposal), secret: result.proposal.secret });
      core.send(res, 200, toolText(id, JSON.stringify({ proposal: result.proposal.id, status: "pending", message: "The person will review it. Nothing changes until they accept." })));`],
]);
edit("src/core/proposals.ts", [
  [`export const publicView = ({ secret: _secret, held, ...proposal }: StoredProposal): Proposal => (held && proposal.status === "pending" ? { ...proposal, status: "waiting-for-class" } : proposal);`, `export const publicView = ({ secret: _secret, ...proposal }: StoredProposal): Proposal => proposal;`],
]);
edit("src/core/routes/proposals.ts", [
  [`import { skipClass } from "../decision-class.ts";\n`, ``],
  [`    if (decision === "accept" && proposal.held) {
      core.send(res, 409, { error: "This decision is waiting for a class: answer it with the Tutor, or choose Decide for me, before accepting" });
      return true;
    }
`, ``],
]);
const p = "src/core/routes/proposals.ts";
let t = fs.readFileSync(p, "utf8");
const eol = t.includes("\r\n") ? "\r\n" : "\n";
const a = t.indexOf('  // "Decide for me": the person skips the decision class');
const b = t.indexOf('  // "Restore": put back the authored files');
if (a < 0 || b < 0) throw new Error("markers in proposals route");
t = t.slice(0, a) + t.slice(b);
fs.writeFileSync(p, t);
edit("src/core/contract.ts", [[`  "If the work needs to depart from the Contract, do not do it silently: make a Proposal with the propose_* tools and let the person decide.";`, `  "Do not invent: take no important decision that the Contract does not already hold. If the work needs something the Contract lacks, or needs to depart from it, do not do it silently: " +
  "make a Proposal with the propose_* tools and let the person decide.";`]]);
