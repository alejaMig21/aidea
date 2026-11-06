import { request } from "node:http";
import { fileURLToPath } from "node:url";
import { startCore } from "../src/core/server.ts";
import { propose, proposePattern, publicView, refusedEvent } from "../src/core/proposals.ts";

export const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

// Starts a core on a free port. Each test file calls this once and closes it afterwards.
export async function startTestCore() {
  const core = await startCore({ port: 0 });

  const post = (path: string, body: unknown) =>
    fetch(core.url + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  const get = (path: string) => fetch(core.url + path);

  // Raw request, so tests can set headers such as Host and Origin that fetch controls itself.
  const raw = (method: string, path: string, headers: Record<string, string>, body?: string) =>
    new Promise<{ status: number; text: string }>((resolve, reject) => {
      const { port } = new URL(core.url);
      const req = request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
        let text = "";
        res.on("data", (c) => (text += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
      });
      req.on("error", reject);
      req.end(body);
    });

  return { core, post, get, raw };
}

// The Builder does not propose changes to the layers (roles-and-contract 11); only the Tutor does. A test of how Proposals are made, shown, decided and applied still needs to make one,
// so a stand-in Builder calls this instead of the MCP tool: it does what the Tutor's tools do (propose() and the events of the stream), answered in the shape of a tool result.
const PROPOSING = ["propose_add_node", "propose_update_node", "propose_remove_node", "propose_pattern_group"];
export async function viaCore(core: any, url: string, rpc: (method: string, params: unknown) => Promise<any>, call: { name: string; arguments?: any }) {
  if (!PROPOSING.includes(call.name)) return rpc("tools/call", call);
  const say = (text: string, isError = false) => ({ jsonrpc: "2.0", id: 0, result: { content: [{ type: "text", text }], ...(isError ? { isError } : {}) } });
  const conversation = core.permissions.conversationOf(url.split("/").pop()!);
  const project = conversation && core.projects.get(conversation.project);
  if (!conversation || !project) return say("The Project is not open", true);
  const args = call.arguments ?? {};
  const kind = call.name === "propose_add_node" ? "add" : call.name === "propose_update_node" ? "update" : "remove";
  const result = call.name === "propose_pattern_group" ? proposePattern(core.proposals, project, conversation.secret, args.group)
    : propose(core.proposals, project, conversation.secret, kind, { layer: args.layer, node: args.node, id: args.id, changes: args.changes });
  if ("error" in result) {
    if (result.refusal) conversation.emit(refusedEvent(result.refusal, "builder"));
    return say(result.error, true);
  }
  conversation.emit({ type: "proposal", ...publicView(result.proposal), secret: result.proposal.secret });
  return say(JSON.stringify({ proposal: result.proposal.id, status: "pending", message: "The person will review it. Nothing changes until they accept." }));
}
