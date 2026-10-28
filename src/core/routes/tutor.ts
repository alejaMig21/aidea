// The Tutor's class: POST /tutor/classes starts one and streams its events (newline-delimited JSON, like /chat);
// POST /tutor/answer is the person's answer to a question the Tutor is waiting on.
// A class is one Tutor process for as long as the stream stays open: closing the stream ends the class.
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Handler } from "../types.ts";
import { TUTOR_INSTRUCTIONS } from "../tutor.ts";
import { currentChoice } from "./agent-options.ts";

const MAX_MESSAGE_CHARS = 20_000;
const FIRST_MESSAGE = "The person has opened a class. Greet them in one sentence and ask your first question.";

const handler: Handler = async (req, res, core) => {
  const path = new URL(req.url ?? "/", "http://core").pathname;
  if (req.method !== "POST" || (path !== "/tutor/classes" && path !== "/tutor/answer")) return false;
  const reject = (status: number, error: string) => {
    core.send(res, status, { error });
    return true;
  };
  const body = (await core.readJson(req, res)) as Record<string, unknown> | null | undefined;
  if (body === undefined) return true; // readJson already answered

  if (path === "/tutor/answer") {
    const { id, secret } = body ?? {};
    if (typeof id !== "string" || typeof secret !== "string") return reject(400, "Send an id and the secret from the question");
    const result = core.permissions.answerQuestion(id, secret, body ?? {});
    if (result === "answered") core.send(res, 200, { ok: true });
    else if (result === "forbidden") return reject(403, "That secret does not belong to this question");
    else if (result === "unknown") return reject(404, "Unknown question, or it was already answered");
    else return reject(400, result.invalid);
    return true;
  }

  const project = typeof body?.project === "string" ? core.projects.get(body.project) : undefined;
  if (!project) return reject(400, "project must be a Project that is already open");
  const message = body?.message ?? FIRST_MESSAGE;
  if (typeof message !== "string" || !message.trim() || message.length > MAX_MESSAGE_CHARS) {
    return reject(400, `message must be a non-empty string of at most ${MAX_MESSAGE_CHARS} characters`);
  }

  res.writeHead(200, { "content-type": "application/x-ndjson" });
  const send = (event: object) => {
    if (!res.writableEnded) res.write(JSON.stringify(event) + "\n");
  };
  const conversation = core.permissions.open(send, project.id, "tutor");
  const tools = {
    mcpConfig: JSON.stringify({ mcpServers: { tutor: { type: "http", url: `http://${req.headers.host}/mcp/${conversation.token}` } } }),
    allowedTools: ["mcp__tutor__*"],
  };
  const abort = new AbortController();
  res.on("close", () => {
    abort.abort();
    conversation.close();
  });
  try {
    // The Tutor works in a neutral empty folder, never in the person's Project: it reads the Project through core tools.
    const cwd = join(tmpdir(), "aidea-tutor");
    mkdirSync(cwd, { recursive: true });
    const { tutorModel } = currentChoice(core, project.id);
    for await (const event of core.adapter.run({ role: "tutor", cwd, message, model: tutorModel, signal: abort.signal, instructions: TUTOR_INSTRUCTIONS, tools })) {
      send(event);
    }
  } catch (e) {
    console.error(e);
    send({ type: "error", code: "failed", message: "The Tutor stopped unexpectedly" });
  } finally {
    conversation.close();
  }
  res.end();
  return true;
};

export default handler;
