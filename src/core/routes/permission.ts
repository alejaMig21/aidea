// The person's answer to a permission card.
import type { Handler } from "../types.ts";

const MAX_MESSAGE_CHARS = 500;

const handler: Handler = async (req, res, core) => {
  if (req.method !== "POST" || new URL(req.url ?? "/", "http://core").pathname !== "/permission") return false;
  const body = (await core.readJson(req, res)) as Record<string, unknown> | null | undefined;
  if (body === undefined) return true; // readJson already answered

  const { id, decision, message } = body ?? {};
  if (typeof id !== "string" || (decision !== "allow" && decision !== "deny")) {
    core.send(res, 400, { error: 'Send an id and a decision of "allow" or "deny"' });
    return true;
  }
  if (message !== undefined && (typeof message !== "string" || message.length > MAX_MESSAGE_CHARS)) {
    core.send(res, 400, { error: `message must be text of at most ${MAX_MESSAGE_CHARS} characters` });
    return true;
  }
  const answered = core.permissions.answer(
    id,
    decision === "allow" ? { behavior: "allow" } : { behavior: "deny", message: message?.trim() || "The person rejected this action" },
  );
  if (!answered) core.send(res, 404, { error: "Unknown request, or it was already answered" });
  else core.send(res, 200, { ok: true });
  return true;
};

export default handler;
