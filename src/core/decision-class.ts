// Decision classes: in Class mode the builder's Blocking decisions are held until the person has answered a short class about
// them (or skipped it). A held Proposal cannot be accepted. The Tutor ends the class with record_decision, which writes the
// person's reason and the rejected alternatives into the Proposal's Rationale and releases it.
import { loadAuthored, rationaleProblem } from "./authored.ts";
import type { Evidence } from "./learner.ts";
import { PATTERN_PREFIX, publicView } from "./proposals.ts";
import type { StoredProposal } from "./proposals.ts";
import type { Core } from "./types.ts";

export const reviewQuestionOn = (core: Core, project: string) => core.preferences.get(project).reviewQuestion !== false; // absent means on
export const classModeOf = (core: Core, project: string): "class" | "direct" => (core.preferences.get(project).classMode === "class" ? "class" : "direct");

// Blocking decisions: a new or changed Node on an authored layer (a technology choice is a field of one), or a Pattern group.
// A removal, and anything about code, is not.
export const isBlocking = (p: StoredProposal) => p.blocking === true || p.nodeId.startsWith(PATTERN_PREFIX) || p.kind === "add" || p.kind === "update";

// Marks a new Proposal as held when the Project is in Class mode. Returns true if it was.
export function holdIfBlocking(core: Core, p: StoredProposal): boolean {
  if (classModeOf(core, p.project) !== "class" || !isBlocking(p)) return false;
  p.held = true;
  return true;
}

// The class running for each held decision, by class id (removed when the class ends).
const decisions = new Map<string, string>();
export const bindDecision = (classId: string, proposalId: string) => void decisions.set(classId, proposalId);
export const unbindDecision = (classId: string) => void decisions.delete(classId);

// A decision class can start only for a Proposal of this Project that is still held.
export function heldDecision(core: Core, project: string, id: unknown): { proposal: StoredProposal } | { error: string } {
  const p = typeof id === "string" ? core.proposals.get(id) : undefined;
  if (!p || p.project !== project || p.status !== "pending" || !p.held) return { error: "decision must be the id of a Proposal of this Project that is waiting for a class" };
  return { proposal: p };
}

export const decisionMessage = (p: StoredProposal) =>
  `The person has opened a decision class. The builder proposed a Blocking decision (proposal ${p.id}) and is held until the person answers. Call read_decision first, then teach it as one short class.`;

export const DECISION_INSTRUCTIONS = [
  "You are the Tutor of aidea, a tool where a person designs software and learns why each decision was made. The builder proposed a decision that blocks until the person has thought about it. You teach ONE short decision class, in plain English and short turns.",
  "1. read_decision: read what the builder proposes (title, layer, what changes, its own reasons). Use read_layers or read_node if you need context.",
  "2. begin_step {stepId, title}, then predict {stepId, prompt}: ask the person what they would choose here AND why, in their own words. Do not reveal the builder's choice. Wait for the reply; a wrong guess is fine.",
  "3. explain {stepId, text}: resolve their guess, then say what the builder proposes and the real trade-off in a few sentences.",
  "4. ask {stepId, kind, prompt, ...}: check that they understood the trade-off with one applied question (choice: 2 to 6 options and `correct`; text: `expected`). If it is missed, explain again and re-check.",
  "5. record_decision {proposalId, reason, rejected: [{option, reason}]}: write down the person's OWN reason, in their words as they said it in this class, and the alternatives that were not chosen with why. Never invent a reason they did not give. If they gave none, ask again with predict before recording. It is refused until the person has answered a question.",
  "6. finish_class {summary}, then end your turn. finish_class is refused until the decision is recorded.",
  "The tools refuse any other order and say what to do next: read the error, fix the call, continue. If a tool says the person did not answer or the class ended, end your turn. You cannot write files or run commands.",
].join("\n");

const rationaleSchema = {
  proposalId: { type: "string", description: "The id of the decision's Proposal, as given by read_decision" },
  reason: { type: "string", description: "The person's own reason for the choice" },
  rejected: { type: "array", items: { type: "object", properties: { option: { type: "string" }, reason: { type: "string" } }, required: ["option", "reason"] }, description: "The alternatives not chosen, each with why" },
};
export const DECISION_TOOLS = [
  { name: "read_decision", description: "Returns the decision this class is about: the Proposal's id, layer, kind, title, what changes and the builder's own Rationale.", inputSchema: { type: "object", properties: {} } },
  {
    name: "record_decision",
    description: "Writes the person's reason and the rejected alternatives into the held decision's Rationale and lets the person accept it. Allowed only after the person answered a question in this class.",
    inputSchema: { type: "object", properties: rationaleSchema, required: ["proposalId", "reason", "rejected"] },
  },
];
export const decisionTools = (classId: string | undefined) => (classId && decisions.has(classId) ? DECISION_TOOLS : []);

type Reply = { text: string; isError?: true };
const fail = (text: string): Reply => ({ text, isError: true });

// finish_class waits for the decision (unless the person already skipped it).
export function finishGate(core: Core, name: unknown, classId: string | undefined): string | null {
  const p = classId && decisions.has(classId) ? core.proposals.get(decisions.get(classId)!) : undefined;
  return name === "finish_class" && p?.held && p.status === "pending" ? "The decision is not recorded yet. Call record_decision with the person's reason and the rejected alternatives first." : null;
}

// Runs read_decision or record_decision for a decision class; null when `name` is not one of them or the class is not one.
export function runDecisionTool(name: unknown, args: Record<string, unknown>, core: Core, classId: string | undefined, emit: (e: object) => void): Reply | null {
  const id = classId && decisions.get(classId);
  if (!id || (name !== "read_decision" && name !== "record_decision")) return null;
  const p = core.proposals.get(id);
  if (!p) return fail("This decision no longer exists. End your turn.");
  if (name === "read_decision") {
    const project = core.projects.get(p.project);
    const current = p.kind === "update" && project ? loadAuthored(project.path).layers[p.layer].nodes.find((n) => n.id === p.nodeId) : undefined; // an update shows the Node as it is now
    return { text: JSON.stringify({ proposalId: p.id, layer: p.layer, kind: p.kind, nodeId: p.nodeId, title: p.node?.title ?? p.node?.name ?? p.nodeId, node: p.node, current, changes: p.changes, builderRationale: p.node?.rationale, status: publicView(p).status }) };
  }
  if (args.proposalId !== id) return fail(`This class is about the decision of proposal ${id}, not ${JSON.stringify(args.proposalId)}. Use proposalId "${id}".`);
  if (!p.held || p.status !== "pending") return fail("This decision is no longer waiting for a class (it was skipped, decided or recorded). End your turn.");
  if (!core.learner.evidence({ classId }).some((e) => !e.dontKnow)) return fail("The person has not answered yet. Ask them with predict (what they would choose and why) and wait for the answer; the reason you record must come from it.");
  const rationale = { why: args.reason, rejected: args.rejected ?? [] };
  const problem = rationaleProblem(rationale);
  if (problem) return fail(`Invalid decision: ${problem}`);
  p.node = { ...p.node, rationale };
  if (p.kind === "update") p.changes = { ...p.changes, rationale };
  delete p.held;
  emit({ type: "decision_ready", proposal: p.id });
  return { text: JSON.stringify({ ok: true, next: "The decision is recorded and the person can accept it now. Call finish_class." }) };
}

// "Decide for me": the person skips the class. The Proposal becomes acceptable as the builder wrote it; the skip is Evidence.
export function skipClass(core: Core, p: StoredProposal): void {
  delete p.held;
  const e: Evidence = { classId: `decision:${p.id}`, questionId: `skip:${p.id}`, project: p.project, kind: "decision-skip", decision: p.id, correct: null, confidence: null, answer: null, thought: null, dontKnow: false, time: new Date().toISOString() };
  try {
    core.learner.recordEvidence(e);
  } catch (err) {
    console.error(err); // a ledger that cannot be written must not stop the person
  }
}
