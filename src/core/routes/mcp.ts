// aidea's own MCP server, as small as it can be. Claude Code (started by aidea) uses it for two things:
//  - `approve`: Claude Code's permission prompt, when a tool call needs the person's permission (ticket 07);
//  - the builder's tools: propose changes to the authored layers and list the proposals (ticket 08). The builder never
//    writes those files itself: its tools only create pending Proposals, and the person decides.
// Plain JSON over HTTP, one message per request. The address contains the token of a running conversation, so only
// the Claude Code process we started can use it.
import { contractOf } from "../contract.ts";
import { decisionTools, finishGate, holdIfBlocking, runDecisionTool } from "../decision-class.ts";
import { publicView, propose, proposePattern, refusedEvent } from "../proposals.ts";
import type { Proposal } from "../proposals.ts";
import { NODE_HELP } from "../tutor-authoring.ts";
import { TUTOR_TOOLS } from "../tutor.ts";
import { runTeachTool } from "../teach.ts";
import { READ_TOOLS, runReadTool } from "../tutor-reads.ts";
import { PROBE_TOOLS, runProbeTool } from "../probe.ts";
import type { Handler } from "../types.ts";

const MAX_MCP_BODY_BYTES = 4 * 1024 * 1024; // a request to write a file carries the whole content

const LAYERS = ["business", "requirements", "architecture"];
const TOOLS = [
  {
    name: "approve",
    description: "Asks the person whether Claude may use a tool. Used by Claude Code's permission prompt.",
    inputSchema: {
      type: "object",
      properties: { tool_name: { type: "string" }, input: { type: "object" }, tool_use_id: { type: "string" } },
      required: ["tool_name", "input"],
    },
  },
  {
    name: "propose_add_node",
    description: `Proposes adding a Node to an authored layer. Nothing changes until the person accepts it. ${NODE_HELP}`,
    inputSchema: { type: "object", properties: { layer: { type: "string", enum: LAYERS }, node: { type: "object" } }, required: ["layer", "node"] },
  },
  {
    name: "propose_pattern_group",
    description:
      "Proposes a Pattern group on the architecture layer: Nodes labelled with their role in a pattern. group = { id, name, kind, roles: [{ node, role }], rationale }. " +
      "kind \"hexagonal\": roles domain, port, adapter, infrastructure. kind \"layered\": roles presentation, application, domain, data. `node` is the id of an architecture Node. " +
      "This is a Blocking decision. Nothing changes until the person accepts it.",
    inputSchema: { type: "object", properties: { group: { type: "object" } }, required: ["group"] },
  },
  {
    name: "propose_update_node",
    description: "Proposes changing fields of an existing Node (give only the fields that change; the id cannot change). Nothing changes until the person accepts it.",
    inputSchema: {
      type: "object",
      properties: { layer: { type: "string", enum: LAYERS }, id: { type: "string" }, changes: { type: "object" } },
      required: ["layer", "id", "changes"],
    },
  },
  {
    name: "propose_remove_node",
    description: "Proposes removing a Node from an authored layer. Nothing changes until the person accepts it.",
    inputSchema: { type: "object", properties: { layer: { type: "string", enum: LAYERS }, id: { type: "string" } }, required: ["layer", "id"] },
  },
  {
    name: "read_contract",
    description: "Returns the Contract: what the person accepted on the Business, Requirements and Architecture layers (pending Proposals are not in it). Read it before you build, and follow it.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true }, // Plan mode asks for any MCP tool that does not say it only reads
  },
  {
    name: "list_proposals",
    description: "Lists the proposals made for this Project and whether the person has accepted, rejected or not yet decided each one.",
    inputSchema: { type: "object", properties: {} },
    annotations: { readOnlyHint: true },
  },
];

const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
const rpcResult = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
// A tool that ran but did not succeed answers with isError, so the builder reads the reason and can try again.
const toolText = (id: unknown, text: string, isError = false) => rpcResult(id, { content: [{ type: "text", text }], ...(isError ? { isError } : {}) });
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

const handler: Handler = async (req, res, core) => {
  const match = /^\/mcp\/([0-9a-f]{32})$/.exec(new URL(req.url ?? "/", "http://core").pathname);
  if (!match) return false;
  const token = match[1];
  if (req.method !== "POST") {
    core.send(res, 405, { error: "Use POST" }, { allow: "POST" });
    return true;
  }
  if (!core.permissions.isOpen(token)) {
    core.send(res, 404, { error: "Unknown conversation" });
    return true;
  }
  const message = await core.readJson(req, res, MAX_MCP_BODY_BYTES);
  if (message === undefined) return true; // readJson already answered

  if (!isObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    core.send(res, 200, rpcError(null, -32600, "Send one JSON-RPC request (batches are not supported)"));
    return true;
  }
  const { id, method } = message;
  const tutor = core.permissions.conversationOf(token)?.role === "tutor";
  const params = isObject(message.params) ? message.params : {};
  if (id === undefined) {
    res.writeHead(202).end(); // a notification: nothing to answer
    return true;
  }

  if (method === "initialize") {
    const version = typeof params.protocolVersion === "string" ? params.protocolVersion : "2025-06-18";
    core.send(res, 200, rpcResult(id, { protocolVersion: version, capabilities: { tools: {} }, serverInfo: { name: "aidea", version: "0.0.0" } }));
  } else if (method === "ping") {
    core.send(res, 200, rpcResult(id, {}));
  } else if (method === "tools/list") {
    const prober = core.permissions.conversationOf(token)?.role === "prober";
    core.send(res, 200, rpcResult(id, { tools: tutor ? [...TUTOR_TOOLS, ...READ_TOOLS, ...decisionTools(core.permissions.conversationOf(token)?.classId)] : prober ? [...PROBE_TOOLS, ...READ_TOOLS] : TOOLS }));
  } else if (method === "tools/call") {
    const args = isObject(params.arguments) ? params.arguments : {};
    const name = params.name;

    if (core.permissions.conversationOf(token)?.role === "prober") {
      // A Probe has its own tool set; its question is withdrawn if Claude Code drops this request before it is answered.
      const gaveUp = new AbortController();
      res.on("close", () => gaveUp.abort());
      const result = await runProbeTool(String(name), args, { core, token, gaveUp: gaveUp.signal });
      core.send(res, 200, result ? toolText(id, result.text, result.isError) : rpcError(id, -32602, `Unknown tool: ${String(name)}`));
      return true;
    }
    if (tutor) {
      // A class has its own tool set. The question is withdrawn if Claude Code drops this request before it is answered.
      if (READ_TOOLS.some((t) => t.name === name)) {
        const conversation = core.permissions.conversationOf(token);
        const project = conversation && core.projects.get(conversation.project);
        const read = project ? runReadTool(name, args, core, project) : { text: "The Project is not open", isError: true as const };
        core.send(res, 200, toolText(id, read!.text, read!.isError));
        return true;
      }
      const conversation = core.permissions.conversationOf(token);
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
      if (!TUTOR_TOOLS.some((t) => t.name === name)) {
        core.send(res, 200, rpcError(id, -32602, `Unknown tool: ${String(name)}`));
        return true;
      }
      const classId = core.permissions.conversationOf(token)?.classId;
      const lesson = classId ? core.lessons.get(classId) : undefined;
      if (!lesson) {
        core.send(res, 200, toolText(id, "The class is not running", true));
        return true;
      }
      // The question is withdrawn if Claude Code drops this request before it is answered.
      const gaveUp = new AbortController();
      res.on("close", () => gaveUp.abort());
      const result = await runTeachTool(String(name), args, { core, token, lesson, gaveUp: gaveUp.signal });
      core.send(res, 200, toolText(id, result.text, result.isError));
      return true;
    }

    if (name === "approve") {
      // The person approves exactly what the card shows, so a request without a proper input is refused, never guessed.
      if (typeof args.tool_name !== "string" || !isObject(args.input)) {
        core.send(res, 200, rpcError(id, -32602, "Call approve with a tool_name and an input object"));
        return true;
      }
      // If Claude Code drops this request before it is answered, the connection closes: that withdraws the card.
      const gaveUp = new AbortController();
      res.on("close", () => gaveUp.abort());
      // The guard rules of the plugins come first: a deny refuses the action with no card, an ask puts the question on the card. A rule can never allow.
      const verdict = core.plugins.guardCheck({ kind: "tool", tool: args.tool_name, input: args.input, project: core.permissions.conversationOf(token)?.project });
      const decision = verdict.decision === "deny"
        ? { behavior: "deny" as const, message: `A plugin rule refused this action: ${verdict.reason}` }
        : (await core.permissions.ask(token, args.tool_name, args.input, gaveUp.signal, verdict.decision === "ask" ? verdict.question : undefined)) ?? { behavior: "deny" as const, message: "The conversation is not running" };
      // Claude Code expects the decision as JSON text: { behavior: "allow", updatedInput } or { behavior: "deny", message }.
      const text = JSON.stringify(decision.behavior === "allow" ? { behavior: "allow", updatedInput: args.input } : decision);
      core.send(res, 200, rpcResult(id, { content: [{ type: "text", text }] }));
    } else if (typeof name === "string" && TOOLS.some((t) => t.name === name)) {
      const conversation = core.permissions.conversationOf(token);
      const project = conversation && core.projects.get(conversation.project);
      if (!conversation || !project) {
        core.send(res, 200, toolText(id, "The Project is not open", true));
        return true;
      }
      if (name === "read_contract") {
        core.send(res, 200, toolText(id, JSON.stringify(contractOf(project.path).layers)));
        return true;
      }
      if (name === "list_proposals") {
        const mine = [...core.proposals.values()].filter((p) => p.project === project.id).map(publicView);
        core.send(res, 200, toolText(id, JSON.stringify({ proposals: mine })));
        return true;
      }
      const kind: Proposal["kind"] = name === "propose_add_node" ? "add" : name === "propose_update_node" ? "update" : "remove";
      const result = name === "propose_pattern_group" ? proposePattern(core.proposals, project, conversation.secret, args.group)
        : propose(core.proposals, project, conversation.secret, kind, { layer: args.layer, node: args.node, id: args.id, changes: args.changes });
      if ("error" in result) {
        if (result.refusal) conversation.emit(refusedEvent(result.refusal, "builder"));
        core.send(res, 200, toolText(id, result.error, true));
        return true;
      }
      // The person's interface hears about it in the chat stream, with the secret that lets it decide.
      const held = holdIfBlocking(core, result.proposal);
      conversation.emit({ type: "proposal", ...publicView(result.proposal), secret: result.proposal.secret });
      if (held) conversation.emit({ type: "decision_class", proposal: result.proposal.id, project: project.id });
      core.send(res, 200, toolText(id, JSON.stringify({ proposal: result.proposal.id, status: held ? "waiting-for-class" : "pending", message: held ? "This is a Blocking decision: the person must first answer a short class about it. It cannot be accepted until then. Carry on with what does not depend on it." : "The person will review it. Nothing changes until they accept." })));
    } else {
      core.send(res, 200, rpcError(id, -32602, `Unknown tool: ${String(name)}`));
    }
  } else {
    core.send(res, 200, rpcError(id, -32601, `Unknown method: ${method}`));
  }
  return true;
};

export default handler;
