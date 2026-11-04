import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { inspect } from "../plugins/api.ts";
import { ManagerError } from "../plugins/manager.ts";
import { QuarantineError } from "../plugins/quarantine.ts";
import type { Handler } from "../types.ts";

const skillFile = fileURLToPath(new URL("../../../docs/plugin-skill.md", import.meta.url));

// The plugin host of the kernel (src/core/plugins). Activate and deactivate are the first operations of the plugin manager; ticket 07 adds the rest.
const handler: Handler = async (req, res, core) => {
  if (req.method === "GET" && req.url === "/plugins") {
    core.send(res, 200, { plugins: core.plugins.list(), services: core.plugins.services(), events: core.plugins.eventList(), safeMode: core.plugins.safe });
    return true;
  }
  // A named call to a plugin's host half.
  const callRoute = /^\/plugins\/([^/?]+)\/call\/([^/?]+)$/.exec(req.url ?? "");
  if (callRoute) {
    if (req.method !== "POST") { core.send(res, 405, { error: "Use POST" }, { allow: "POST" }); return true; }
    const body = await core.readJson(req, res);
    if (body === undefined) return true;
    const answer = core.plugins.callApi(decodeURIComponent(callRoute[1]), decodeURIComponent(callRoute[2]), body);
    if (!answer) { core.send(res, 404, { error: "That plugin has no such call" }); return true; }
    try { core.send(res, 200, (await answer) ?? null); } catch (e) { core.send(res, 500, { error: e instanceof Error ? e.message : String(e) }); }
    return true;
  }
  // The settings of one plugin: the schema, the values (a secret only as set or not), and saving valid values.
  const settingsRoute = /^\/plugins\/([^/?]+)\/settings$/.exec(req.url ?? "");
  if (settingsRoute && (req.method === "GET" || req.method === "POST")) {
    const id = decodeURIComponent(settingsRoute[1]);
    const schema = core.plugins.schemaOf(id);
    if (!schema) { core.send(res, 404, { error: "There is no such plugin" }); return true; }
    if (req.method === "GET") { core.send(res, 200, { schema, values: core.settings.values(id, schema) }); return true; }
    const body = (await core.readJson(req, res)) as { values?: unknown } | null | undefined;
    if (body === undefined) return true;
    if (!body || typeof body.values !== "object" || body.values === null || Array.isArray(body.values)) { core.send(res, 400, { error: "send { values: { name: value } }", errors: {} }); return true; }
    const result = core.settings.save(id, schema, body.values as Record<string, unknown>);
    core.send(res, "errors" in result ? 400 : 200, result);
    return true;
  }
  // The live inspection (read-only) and the skill an agent reads before it writes a plugin.
  if (req.method === "GET" && req.url === "/plugins/inspect") {
    core.send(res, 200, inspect(core.plugins));
    return true;
  }
  if (req.method === "GET" && req.url === "/plugins/skill") {
    res.writeHead(200, { "content-type": "text/markdown; charset=utf-8", "cache-control": "no-cache" });
    res.end(readFileSync(skillFile));
    return true;
  }
  // Switch a plugin on or off, or take it out. Each answers with a status: applied, failed or restart-required.
  const change = req.method === "POST" ? /^\/plugins\/(enable|disable|remove)$/.exec(req.url ?? "")?.[1] : undefined;
  if (change) {
    const body = (await core.readJson(req, res)) as { id?: unknown; deleteData?: unknown } | null | undefined;
    if (body === undefined) return true;
    if (typeof body?.id !== "string" || (body.deleteData !== undefined && typeof body.deleteData !== "boolean")) {
      core.send(res, 400, { error: "send the id of a plugin (and, to remove, optionally deleteData as true or false)" });
      return true;
    }
    try {
      core.send(res, 200, await (change === "remove" ? core.manager.remove(body.id, body.deleteData === true) : change === "enable" ? core.manager.enable(body.id) : core.manager.disable(body.id)));
    } catch (e) {
      if (!(e instanceof ManagerError)) throw e;
      core.send(res, e.status, { error: e.message, ...e.extra });
    }
    return true;
  }
  // Installs a plugin from the quarantine. `confirm` lists the keys of the blocking findings the person confirms by name.
  if (req.method === "POST" && (req.url === "/plugins/install" || req.url === "/plugins/update")) {
    const body = (await core.readJson(req, res)) as { id?: unknown; confirm?: unknown } | null | undefined;
    if (body === undefined) return true;
    if (typeof body?.id !== "string" || !/^[0-9a-f]{8}$/.test(body.id) || (body.confirm !== undefined && !(Array.isArray(body.confirm) && body.confirm.every((k) => typeof k === "string")))) {
      core.send(res, 400, { error: "send the id of a quarantine entry and, optionally, a list of finding keys" });
      return true;
    }
    try {
      core.send(res, 200, await (req.url === "/plugins/update" ? core.manager.update(body.id, body.confirm as string[] | undefined) : core.manager.install(body.id, body.confirm as string[] | undefined)));
    } catch (e) {
      if (!(e instanceof ManagerError)) throw e;
      core.send(res, e.status, { error: e.message, ...e.extra });
    }
    return true;
  }
  // The quarantine: plugins that were added and are waiting. Nothing of them runs.
  if (req.url === "/plugins/quarantine" || req.url?.startsWith("/plugins/quarantine/")) {
    try {
      if (req.method === "GET" && req.url === "/plugins/quarantine") {
        core.send(res, 200, { entries: core.quarantine.list().map(core.manager.describe) });
        return true;
      }
      const one = req.method === "GET" ? /^\/plugins\/quarantine\/([\w-]+)$/.exec(req.url)?.[1] : undefined;
      if (one) {
        const entry = core.quarantine.get(one);
        core.send(res, entry ? 200 : 404, entry ? core.manager.describe(entry) : { error: "No quarantine entry with that id" });
        return true;
      }
      if (req.method === "POST" && (req.url === "/plugins/quarantine" || req.url === "/plugins/quarantine/discard")) {
        const body = (await core.readJson(req, res)) as { source?: unknown; id?: unknown } | null | undefined;
        if (body === undefined) return true;
        if (req.url === "/plugins/quarantine") core.send(res, 201, core.manager.describe(await core.quarantine.add(body?.source)));
        else { core.quarantine.discard(body?.id); core.send(res, 200, { ok: true }); }
        return true;
      }
    } catch (e) {
      if (!(e instanceof QuarantineError)) throw e;
      core.send(res, 400, { error: e.message });
      return true;
    }
    return false;
  }
  // The interface half of an active plugin, to be loaded by the window.
  const uiId = req.method === "GET" ? /^\/plugins\/([a-z][a-z0-9.-]{2,63})\/ui$/.exec(req.url ?? "")?.[1] : undefined;
  if (uiId) {
    const file = core.plugins.uiFile(uiId);
    if (!file) core.send(res, 404, { error: "That plugin has no active interface half" });
    else {
      res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache", "x-content-type-options": "nosniff" });
      res.end(readFileSync(file));
    }
    return true;
  }
  // The window reports that it could not activate the interface half of a plugin.
  if (req.method === "POST" && req.url === "/plugins/ui-state") {
    const body = (await core.readJson(req, res)) as { id?: unknown; reason?: unknown } | null | undefined;
    if (body === undefined) return true;
    if (typeof body?.id !== "string" || typeof body?.reason !== "string" || !core.plugins.has(body.id)) {
      core.send(res, 400, { error: "send the id of a plugin and a reason" });
      return true;
    }
    await core.plugins.markFailed(body.id, body.reason.slice(0, 300));
    core.send(res, 200, { ok: true });
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
