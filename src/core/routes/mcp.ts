// aidea's own MCP server, as small as it can be: one tool, `approve`, which Claude Code calls (through
// --permission-prompt-tool) when a tool call needs the person's permission. Plain JSON over HTTP, no streaming.
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
  const body = await core.readJson(req, res, MAX_MCP_BODY_BYTES);
  if (body === undefined) return true; // readJson already answered

  const replies: object[] = [];
  for (const message of Array.isArray(body) ? body : [body]) {
    if (!isObject(message) || message.jsonrpc !== "2.0" || typeof message.method !== "string") {
      replies.push(rpcError(isObject(message) ? message.id ?? null : null, -32600, "Not a JSON-RPC request"));
      continue;
    }
    const { id, method } = message;
    const params = isObject(message.params) ? message.params : {};
    if (id === undefined) continue; // a notification: nothing to answer

    if (method === "initialize") {
      const version = typeof params.protocolVersion === "string" ? params.protocolVersion : "2025-06-18";
      replies.push(rpcResult(id, { protocolVersion: version, capabilities: { tools: {} }, serverInfo: { name: "aidea", version: "0.0.0" } }));
    } else if (method === "ping") {
      replies.push(rpcResult(id, {}));
    } else if (method === "tools/list") {
      replies.push(rpcResult(id, { tools: [TOOL] }));
    } else if (method === "tools/call") {
      const args = isObject(params.arguments) ? params.arguments : {};
      if (params.name !== TOOL.name || typeof args.tool_name !== "string") {
        replies.push(rpcError(id, -32602, "Call approve with tool_name and input"));
        continue;
      }
      const input = isObject(args.input) ? args.input : {};
      const decision = (await core.permissions.ask(token, args.tool_name, input)) ?? { behavior: "deny" as const, message: "The conversation is not running" };
      // Claude Code expects the decision as JSON text: { behavior: "allow", updatedInput } or { behavior: "deny", message }.
      const text = JSON.stringify(decision.behavior === "allow" ? { behavior: "allow", updatedInput: input } : decision);
      replies.push(rpcResult(id, { content: [{ type: "text", text }] }));
    } else {
      replies.push(rpcError(id, -32601, `Unknown method: ${method}`));
    }
  }

  if (replies.length === 0) res.writeHead(202).end();
  else core.send(res, 200, Array.isArray(body) ? replies : replies[0]);
  return true;
};

export default handler;
