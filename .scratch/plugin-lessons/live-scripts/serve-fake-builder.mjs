// Serves aidea's real core and interface on http://127.0.0.1:4821 with a stand-in Builder that proposes two plugin folders of the Project: one without a lesson, one with a lesson.
// Send any message in the Builder panel; the stand-in answers with what propose_plugin said for each.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
const root = join(import.meta.dirname, "serve-builder-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
const project = join(root, "shop");
mkdirSync(project, { recursive: true });
writeFileSync(join(project, "app.py"), "def go():\n    return 1\n");
const plugin = (name, withLesson) => {
  const dir = join(project, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id: `builder.${name}`, version: "1.0.0", title: `Builder ${name}`, description: "Written by the Builder.", publisher: "builder", api: "0.1", ui: "ui.js", ...(withLesson ? { lesson: "lesson.json" } : {}) }));
  writeFileSync(join(dir, "ui.js"), "export function activate() {}");
  if (withLesson) writeFileSync(join(dir, "lesson.json"), JSON.stringify({ parts: [{ name: "The plugin", hint: "h", what: "w", question: "q?", example: "e", narration: "n", tryIt: "t", refs: [] }] }));
};
plugin("nolesson", false);
plugin("withlesson", true);
const adapter = { options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] }, run: async function* ({ permission }) {
  const url = JSON.parse(permission.mcpConfig).mcpServers.aidea.url;
  const rpc = (method, params, id) => fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "live", version: "0" } }, 1);
  for (const path of ["nolesson", "withlesson"]) {
    const r = (await (await rpc("tools/call", { name: "propose_plugin", arguments: { path } }, 4)).json()).result;
    yield { type: "text", text: `${path}: ${r.isError ? "REFUSED" : "PROPOSED"}. ${r.content[0].text.slice(0, 160)}` };
  }
} };
const core = await startCore({ port: 4821, adapter, pluginsDir: join(root, "store"), builtinPluginsDir: false, recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json"), learnerDir: join(root, "learner") });
console.log("ready", core.url, project);
