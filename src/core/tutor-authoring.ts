// Co-authoring in a layer class: the person speaks first, then the Tutor turns their words into a pending Proposal.
// The Tutor's tools go through the same `propose` as the builder's (same validation, same messages) but are refused
// until the person has answered a question about the same element in this class. A Proposal still needs the person's accept.
import { evidenceOf } from "./learner.ts";
import { propose } from "./proposals.ts";
import type { Proposal } from "./proposals.ts";
import type { Lesson } from "./teach.ts";
import { parseQuestion } from "./tutor.ts";
import type { Core } from "./types.ts";

export const NODE_HELP =
  "A Node has a unique `id`, a `title` and a `rationale` { why, rejected: [{ option, reason }] } that explains the decision and the alternatives " +
  "that were rejected. Business Nodes also need `block` (one of the nine Business Model Canvas blocks, such as \"value propositions\"); " +
  "requirements Nodes have a `kind`, \"functional\" (the default: needs `as`, `want`, `so`; may have `criteria`, an array of Given/When/Then lines) " +
  "or \"non-functional\" (needs `statement`, `quality` (performance, security, usability, reliability, maintainability, compatibility, portability or safety) " +
  "and a measurable `measure`; `as`, `want`, `so` are not needed); architecture Nodes need `technology` and may have `parent` (the Node it is inside), `kind` (person, system, container or component), " +
  "a one-sentence `description`, `external` (true for a person or system outside the one being designed) and `relations`: [{ to, label, technology? }] naming other architecture Nodes that this one uses. Any Node may have " +
  "`traces`: the ids of the Nodes in the layer below that realise it. To mark architecture Nodes as one pattern (for example hexagonal) use propose_pattern_group.";

const element = { type: "string", description: "The layer element the question was about, the same short tag you gave `ask`, for example \"business:customer-segments\"" };
const LAYERS = { type: "string", enum: ["business", "requirements", "architecture"] };
const CITE = " Quote the person's own words in rationale.why: the answer comes back to you from ask and is also attached to the Proposal.";

export const AUTHORING_TOOLS = [
  {
    name: "propose_node",
    description: `Proposes adding a Node to a layer, from what the person said. Refused until the person answered an \`ask\` tagged with the same \`element\`. Nothing changes until the person accepts.${CITE} ${NODE_HELP}`,
    inputSchema: {
      type: "object",
      properties: { layer: LAYERS, node: { type: "object" }, element, because: { type: "string", description: "Optional: one sentence on why you propose it" } },
      required: ["layer", "node", "element"],
    },
  },
  {
    name: "propose_change",
    description: `Proposes changing fields of an existing Node, from what the person said (give only the fields that change; the id cannot change). Refused until the person answered an \`ask\` tagged with the same \`element\`. Nothing changes until the person accepts.${CITE}`,
    inputSchema: { type: "object", properties: { layer: LAYERS, id: { type: "string" }, changes: { type: "object" }, element }, required: ["layer", "id", "changes", "element"] },
  },
];

type Reply = { text: string; isError?: true };
type Ctx = { core: Core; token: string; lesson: Lesson; gaveUp: AbortSignal };
const err = (text: string): Reply => ({ text, isError: true });
const tag = (v: unknown) => (typeof v === "string" && v.trim() && v.length <= 100 ? v.trim() : null);

// Handles `ask` with an element, propose_node and propose_change. Anything else is not ours (undefined).
export async function runAuthoringTool(name: string, args: Record<string, unknown>, { core, token, lesson, gaveUp }: Ctx): Promise<Reply | undefined> {
  const isAsk = name === "ask" && args.element !== undefined;
  if (!isAsk && name !== "propose_node" && name !== "propose_change") return undefined;
  const conversation = core.permissions.conversationOf(token);
  if (!conversation?.classId) return err("The class is not running");
  const key = tag(args.element);
  if (!key) return err("element must be a short text naming the layer element, for example \"business:customer-segments\"");

  if (isAsk) {
    if (args.kind !== "text") return err('A question about a layer element must be kind "text": the person answers in their own words. Offer alternatives inside the prompt of a later question.');
    const parsed = parseQuestion(args);
    if ("error" in parsed) return err(parsed.error);
    const result = await core.permissions.askQuestion(token, parsed.question, gaveUp);
    if (!result) return err("The class is not running");
    if (!result.heard) return { text: result.text, isError: result.isError };
    const { questionId, question, answer } = result.heard;
    try {
      core.learner.recordEvidence(evidenceOf(conversation.classId, questionId, conversation.project, question, answer));
    } catch (e) {
      console.error(e); // a ledger that cannot be written must not stop the class
    }
    if (answer.text) lesson.elements.set(key, { questionId, text: answer.text });
    return { text: JSON.stringify({ ok: true, element: key, ...(JSON.parse(result.text) as object), next: answer.text ? "Now turn their words into a Proposal with propose_node or propose_change, using the same element." : "They did not answer in words: do not propose anything about this element yet." }) };
  }

  const heard = lesson.elements.get(key);
  if (!heard) return err(`Ask the person about ${key} first and wait for the answer: call ask with element "${key}", then propose.`);
  if (args.because !== undefined && (typeof args.because !== "string" || args.because.length > 1000)) return err("because must be text of at most 1000 characters");
  const project = core.projects.get(conversation.project);
  if (!project) return err("The Project is not open");
  const kind: Proposal["kind"] = name === "propose_node" ? "add" : "update";
  const result = propose(core.proposals, project, conversation.secret, kind, { layer: args.layer, node: args.node, id: args.id, changes: args.changes });
  if ("error" in result) return err(result.error);
  const p = result.proposal;
  p.source = { role: "tutor", classId: conversation.classId, questionId: heard.questionId };
  p.fromAnswer = heard.text;
  if (typeof args.because === "string" && args.because.trim()) p.because = args.because.trim();
  conversation.emit({ type: "proposal", ...p });
  return { text: JSON.stringify({ proposal: p.id, status: "pending", message: "The person will review it. Nothing changes until they accept. You may now offer other ways to see this, as a question." }) };
}
