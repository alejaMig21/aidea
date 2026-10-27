// aidea's own MCP server, as small as it can be: one tool, `approve`, which Claude Code calls (through
// --permission-prompt-tool) when a tool call needs the person's permission. Plain JSON over HTTP, one message per request.
// The address contains the token of a running conversation, so only the Claude Code process we started can use it.
import type { Handler } from "../types.ts";

const MAX_MCP_BODY_BYTES = 4 * 1024 * 1024; // a request to write a file carries the whole content
const TOOL = {
  name: "approve",
  description: "Asks the person whether Claude may use a tool. Used by Claude Code's permission prompt.",
  inputSchema: {
    type: "object",
    properties: { tool_name: { type: "string" }, input: { type: "object" }, tool_use_id: { type: "string" } },
    required: ["tool_name", "input"],
  },
};

const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: "2.0", id, error: { code, message } });
const rpcResult = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id, result });
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
    core.send(res, 200, rpcResult(id, { tools: [TOOL] }));
  } else if (method === "tools/call") {
    const args = isObject(params.arguments) ? params.arguments : {};
    // The person approves exactly what the card shows, so a request without a proper input is refused, never guessed.
    if (params.name !== TOOL.name || typeof args.tool_name !== "string" || !isObject(args.input)) {
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
  } else {
    core.send(res, 200, rpcError(id, -32601, `Unknown method: ${method}`));
  }
  return true;
};

export default handler;
