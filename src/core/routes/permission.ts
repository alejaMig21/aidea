// The person's answer to a permission card. The card carries the conversation's answer secret, which only the
// interface receives (in the chat stream), so the builder cannot answer its own requests.
import type { Handler } from "../types.ts";

const MAX_MESSAGE_CHARS = 500;

const handler: Handler = async (req, res, core) => {
  if (req.method !== "POST" || new URL(req.url ?? "/", "http://core").pathname !== "/permission") return false;
  const body = (await core.readJson(req, res)) as Record<string, unknown> | null | undefined;
  if (body === undefined) return true; // readJson already answered

  const { id, secret, decision, message } = body ?? {};
  if (typeof id !== "string" || typeof secret !== "string" || (decision !== "allow" && decision !== "deny")) {
    core.send(res, 400, { error: 'Send an id, the secret from the card and a decision of "allow" or "deny"' });
    return true;
  }
  if (message !== undefined && (typeof message !== "string" || message.length > MAX_MESSAGE_CHARS)) {
    core.send(res, 400, { error: `message must be text of at most ${MAX_MESSAGE_CHARS} characters` });
    return true;
  }
  const result = core.permissions.answer(
    id,
    secret,
    // The reason is worded as the person's own: Claude Code treats a bare text inside a tool result as untrusted.
    decision === "allow"
      ? { behavior: "allow" }
      : { behavior: "deny", message: message?.trim() ? `The person rejected this action and wrote: "${message.trim()}"` : "The person rejected this action" },
  );
  if (result === "answered") core.send(res, 200, { ok: true });
  else if (result === "forbidden") core.send(res, 403, { error: "That secret does not belong to this request" });
  else core.send(res, 404, { error: "Unknown request, or it was already answered" });
  return true;
};

export default handler;
