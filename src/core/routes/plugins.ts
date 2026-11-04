import type { Handler } from "../types.ts";

// The plugin host of the kernel (src/core/plugins). Activate and deactivate are the first operations of the plugin manager; ticket 07 adds the rest.
const handler: Handler = async (req, res, core) => {
  if (req.method === "GET" && req.url === "/plugins") {
    core.send(res, 200, { plugins: core.plugins.list(), services: core.plugins.services() });
    return true;
  }
  const action = req.method === "POST" ? /^\/plugins\/(activate|deactivate)$/.exec(req.url ?? "")?.[1] : undefined;
  if (action) {
    const body = (await core.readJson(req, res)) as { id?: unknown } | null | undefined;
    if (body === undefined) return true; // readJson already answered
    if (typeof body?.id !== "string") {
      core.send(res, 400, { error: "id must be a string" });
      return true;
    }
    if (!core.plugins.has(body.id)) {
      core.send(res, 404, { error: "No plugin with that id" });
      return true;
    }
    await (action === "activate" ? core.plugins.activate(body.id) : core.plugins.deactivate(body.id));
    core.send(res, 200, { plugin: core.plugins.list().find((p) => p.id === body.id) });
    return true;
  }
  return false;
};

export default handler;
