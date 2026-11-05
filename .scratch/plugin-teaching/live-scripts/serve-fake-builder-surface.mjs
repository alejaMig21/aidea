// Serves aidea's real core and interface on http://127.0.0.1:4822 with a stand-in Builder that proposes three plugin folders of the Project:
// a Panel with a lesson but no teaching surface (refused), a Panel with a lesson and a surface (proposed) and a guard rule with only a lesson (proposed).
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
const root = join(import.meta.dirname, "serve-surface-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
const project = join(root, "shop");
mkdirSync(project, { recursive: true });
writeFileSync(join(project, "app.py"), "def go():\n    return 1\n");
const LESSON = JSON.stringify({ parts: [{ name: "The plugin", hint: "h", what: "w", question: "q?", example: "e", narration: "n", tryIt: "t", refs: [] }] });
const plugin = (name, { ui, surface }) => {
  const dir = join(project, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id: `builder.${name}`, version: "1.0.0", title: `Builder ${name}`, description: "Written by the Builder.", publisher: "builder", api: "0.1", main: "main.js", lesson: "lesson.json", ...(ui ? { ui: "ui.js" } : {}), ...(surface ? { teach: { view: "state", module: "teach.mjs", checks: [{ name: "is-open", says: "The Panel is open." }] } } : {}) }));
  writeFileSync(join(dir, "main.js"), "export function activate() {}");
  writeFileSync(join(dir, "lesson.json"), LESSON);
  if (ui) writeFileSync(join(dir, "ui.js"), "export function activate() {}");
  if (surface) writeFileSync(join(dir, "teach.mjs"), 'export const view = (s) => s;\nexport const checks = { "is-open": () => ({ ok: true }) };');
};
plugin("panel-no-surface", { ui: true });
plugin("panel-with-surface", { ui: true, surface: true });
plugin("guard-rule", {});
const adapter = { options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] }, run: async function* ({ permission }) {
  const url = JSON.parse(permission.mcpConfig).mcpServers.aidea.url;
  const rpc = (method, params, id) => fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "live", version: "0" } }, 1);
  for (const path of ["panel-no-surface", "panel-with-surface", "guard-rule"]) {
    const r = (await (await rpc("tools/call", { name: "propose_plugin", arguments: { path } }, 4)).json()).result;
    yield { type: "text", text: `${path}: ${r.isError ? "REFUSED" : "PROPOSED"}. ${r.content[0].text.slice(0, 150)}` };
  }
} };
const core = await startCore({ port: 4822, adapter, pluginsDir: join(root, "store"), builtinPluginsDir: false, recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json"), learnerDir: join(root, "learner") });
console.log("ready", core.url, project);
