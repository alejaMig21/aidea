import type { Handler } from "../types.ts";

const handler: Handler = async (req, res, core) => {
  if (req.method === "GET" && req.url === "/recents") {
    core.send(res, 200, core.recents.list());
    return true;
  }
  if (req.method === "POST" && req.url === "/recents/forget") {
    const body = (await core.readJson(req, res)) as { path?: unknown } | null | undefined;
    if (body === undefined) return true; // readJson already answered
    if (typeof body?.path !== "string") {
      core.send(res, 400, { error: "path must be a string" });
      return true;
    }
    core.recents.forget(body.path);
    core.send(res, 200, { ok: true });
    return true;
  }
  return false;
};

export default handler;
