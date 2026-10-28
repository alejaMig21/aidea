// aidea's own MCP server, as small as it can be. Claude Code (started by aidea) uses it for two things:
//  - `approve`: Claude Code's permission prompt, when a tool call needs the person's permission (ticket 07);
//  - the builder's tools: propose changes to the authored layers and list the proposals (ticket 08). The builder never
//    writes those files itself: its tools only create pending Proposals, and the person decides.
// Plain JSON over HTTP, one message per request. The address contains the token of a running conversation, so only
// the Claude Code process we started can use it.
import { contractOf } from "../contract.ts";
import { publicView, propose } from "../proposals.ts";
import type { Proposal } from "../proposals.ts";
import { TUTOR_TOOLS, parseQuestion } from "../tutor.ts";
import type { Handler } from "../types.ts";

const MAX_MCP_BODY_BYTES = 4 * 1024 * 1024; // a request to write a file carries the whole content

const LAYERS = ["business", "requirements", "architecture"];
const NODE_HELP =
  "A Node has a unique `id`, a `title` and a `rationale` { why, rejected: [{ option, reason }] } that explains the decision and the alternatives " +
  "that were rejected. Business Nodes also need `block` (one of the nine Business Model Canvas blocks, such as \"value propositions\"); " +
  "requirements Nodes have a `kind`, \"functional\" (the default: needs `as`, `want`, `so`; may have `criteria`, an array of Given/When/Then lines) " +
  "or \"non-functional\" (needs `statement`, `quality` (performance, security, usability, reliability, maintainability, compatibility, portability or safety) " +
  "and a measurable `measure`; `as`, `want`, `so` are not needed); architecture Nodes need `technology` and may have `parent` (the Node it is inside), `kind` (person, system, container or component), " +
  "a one-sentence `description`, `external` (true for a person or system outside the one being designed) and `relations`: [{ to, label, technology? }] naming other architecture Nodes that this one uses. Any Node may have " +
  "`traces`: the ids of the Nodes in the layer below that realise it.";

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
  },
  {
    name: "list_proposals",
    description: "Lists the proposals made for this Project and whether the person has accepted, rejected or not yet decided each one.",
    inputSchema: { type: "object", properties: {} },
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
    core.send(res, 200, rpcResult(id, { tools: tutor ? TUTOR_TOOLS : TOOLS }));
  } else if (method === "tools/call") {
    const args = isObject(params.arguments) ? params.arguments : {};
    const name = params.name;

    if (tutor) {
      // A class has its own tool set. The question is withdrawn if Claude Code drops this request before it is answered.
      if (name !== "ask") {
        core.send(res, 200, rpcError(id, -32602, `Unknown tool: ${String(name)}`));
        return true;
      }
      const parsed = parseQuestion(args);
      if ("error" in parsed) {
        core.send(res, 200, toolText(id, parsed.error, true));
        return true;
      }
      const gaveUp = new AbortController();
      res.on("close", () => gaveUp.abort());
      const result = (await core.permissions.askQuestion(token, parsed.question, gaveUp.signal)) ?? { text: "The class is not running", isError: true as const };
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
      const decision = (await core.permissions.ask(token, args.tool_name, args.input, gaveUp.signal)) ?? { behavior: "deny" as const, message: "The conversation is not running" };
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
      const result = propose(core.proposals, project, conversation.secret, kind, { layer: args.layer, node: args.node, id: args.id, changes: args.changes });
      if ("error" in result) {
        core.send(res, 200, toolText(id, result.error, true));
        return true;
      }
      // The person's interface hears about it in the chat stream, with the secret that lets it decide.
      conversation.emit({ type: "proposal", ...result.proposal });
      core.send(res, 200, toolText(id, JSON.stringify({ proposal: result.proposal.id, status: "pending", message: "The person will review it. Nothing changes until they accept." })));
    } else {
      core.send(res, 200, rpcError(id, -32602, `Unknown tool: ${String(name)}`));
    }
  } else {
    core.send(res, 200, rpcError(id, -32601, `Unknown method: ${method}`));
  }
  return true;
};

export default handler;
