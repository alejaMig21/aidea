import type { Handler } from "../types.ts";
import { BUILDER_INSTRUCTIONS } from "../contract.ts";
import { begin, finish } from "../guard.ts";
import { currentChoice } from "./agent-options.ts";

const MAX_MESSAGE_CHARS = 20_000;
const SESSION_ID = /^[A-Za-z0-9][\w-]{0,99}$/;

const handler: Handler = async (req, res, core) => {
  if (req.method !== "POST" || new URL(req.url ?? "/", "http://core").pathname !== "/chat") return false;
  const reject = (status: number, error: string) => {
    core.send(res, status, { error });
    return true;
  };

  const body = (await core.readJson(req, res)) as Record<string, unknown> | null | undefined;
  if (body === undefined) return true; // readJson already answered
  const project = typeof body?.project === "string" ? core.projects.get(body.project) : undefined;
  if (!project) return reject(400, "project must be a Project that is already open");
  const { message, sessionId } = body ?? {};
  if (typeof message !== "string" || !message.trim() || message.length > MAX_MESSAGE_CHARS) {
    return reject(400, `message must be a non-empty string of at most ${MAX_MESSAGE_CHARS} characters`);
  }
  if (sessionId !== undefined && (typeof sessionId !== "string" || !SESSION_ID.test(sessionId))) {
    return reject(400, "sessionId has an invalid shape");
  }

  // Streams newline-delimited JSON: one aidea event per line, in order.
  res.writeHead(200, { "content-type": "application/x-ndjson" });
  const send = (event: object) => {
    if (!res.writableEnded) res.write(JSON.stringify(event) + "\n");
  };

  // The builder may ask the person for permission during this conversation: it reaches Claude Code as an MCP tool whose
  // address holds this conversation's secret token, and the requests come back to the person as events in this stream.
  const conversation = core.permissions.open(send, project.id);
  const permission = {
    mcpConfig: JSON.stringify({ mcpServers: { aidea: { type: "http", url: `http://${req.headers.host}/mcp/${conversation.token}` } } }),
    tool: "mcp__aidea__approve",
    allowedTools: ["propose_add_node", "propose_update_node", "propose_remove_node", "propose_pattern_group", "list_proposals", "read_contract", "read_plugin_guide", "propose_plugin"].map((t) => `mcp__aidea__${t}`),
    // The authored files change only through Proposals. A shell pattern is not a wall: the check after the turn (guard.ts) is.
    deniedTools: [...["Write", "Edit", "MultiEdit", "NotebookEdit"].map((t) => `${t}(.aidea/**)`), "Bash(*.aidea*)"],
  };
  let watch: ReturnType<typeof begin> | undefined;

  // If the interface goes away mid-reply, stop the agent and deny whatever is waiting.
  const abort = new AbortController();
  res.on("close", () => {
    abort.abort();
    conversation.close();
  });
  try {
    watch = begin(project.path);
    const { mode, model } = currentChoice(core, project.id);
    for await (const event of core.adapter.run({ cwd: project.path, message, sessionId, mode, model, signal: abort.signal, permission, instructions: BUILDER_INSTRUCTIONS })) {
      send(event);
    }
  } catch (e) {
    // Headers are already sent, so the failure travels as an event; the detail stays in the core's log.
    console.error(e);
    send({ type: "error", code: "failed", message: "The builder stopped unexpectedly" });
  } finally {
    conversation.close();
    const changed = watch && finish(watch);
    if (changed) send({ type: "authored_changed", ...changed });
  }
  res.end();
  return true;
};

export default handler;
