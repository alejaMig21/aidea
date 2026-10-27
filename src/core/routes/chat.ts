import type { Handler } from "../types.ts";

const MAX_MESSAGE_CHARS = 20_000;
const SESSION_ID = /^[A-Za-z0-9][\w-]{0,99}$/;

const handler: Handler = async (req, res, core) => {
  if (req.method !== "POST" || req.url !== "/chat") return false;
  const reject = (status: number, error: string) => {
    core.send(res, status, { error }, status === 413 ? { connection: "close" } : {});
    return true;
  };

  const raw = await core.readBody(req);
  if (raw === null) return reject(413, "Body too large");
  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return reject(400, "Body must be JSON");
  }
  const project = typeof body?.project === "string" ? core.projects.get(body.project) : undefined;
  if (!project) return reject(400, "project must be a Project that is already open");
  const { message, sessionId } = body;
  if (typeof message !== "string" || !message.trim() || message.length > MAX_MESSAGE_CHARS) {
    return reject(400, `message must be a non-empty string of at most ${MAX_MESSAGE_CHARS} characters`);
  }
  if (sessionId !== undefined && (typeof sessionId !== "string" || !SESSION_ID.test(sessionId))) {
    return reject(400, "sessionId has an invalid shape");
  }

  // Streams newline-delimited JSON: one aidea event per line, in order.
  res.writeHead(200, { "content-type": "application/x-ndjson" });
  // If the interface goes away mid-reply, stop the agent.
  const abort = new AbortController();
  res.on("close", () => abort.abort());
  for await (const event of core.adapter.run({ cwd: project.path, message, sessionId, signal: abort.signal })) {
    res.write(JSON.stringify(event) + "\n");
  }
  res.end();
  return true;
};

export default handler;
