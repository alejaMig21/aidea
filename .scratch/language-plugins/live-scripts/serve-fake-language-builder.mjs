// Serves aidea's real core and interface on http://127.0.0.1:4825 with a stand-in Builder that copies docs/plugin-template-language for a made-up language (Zed, .zed), changes the id and the extension, and proposes it.
// In the page: send any message in the Builder panel, install the plugin from the Plugins manager, and reopen the Project: the Zed files are drawn on the Components layer.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
const root = join(import.meta.dirname, "serve-zed-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
const project = join(root, "shop");
mkdirSync(join(project, "src"), { recursive: true });
writeFileSync(join(project, "src", "orders.zed"), "order");
writeFileSync(join(project, "src", "carts.zed"), "cart");
const adapter = { options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] }, run: async function* ({ permission }) {
  const folder = join(project, "zed-language");
  cpSync("D:/Projects/aidea/docs/plugin-template-language", folder, { recursive: true });
  const edit = (file, change) => writeFileSync(join(folder, file), change(readFileSync(join(folder, file), "utf8")));
  edit("aidea-plugin.json", (t) => t.replaceAll("my-language", "zed-language").replaceAll('"My language"', '"Zed language"').replace(".mylang", ".zed"));
  edit("main.js", (t) => t.replace('".mylang"', '".zed"'));
  edit("lesson.json", (t) => t.replaceAll("my-language", "zed-language"));
  const url = JSON.parse(permission.mcpConfig).mcpServers.aidea.url;
  const rpc = (method, params, id) => fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "live", version: "0" } }, 1);
  const r = (await (await rpc("tools/call", { name: "propose_plugin", arguments: { path: "zed-language" } }, 2)).json()).result;
  yield { type: "text", text: `${r.isError ? "REFUSED" : "PROPOSED"}: ${r.content[0].text.slice(0, 140)}` };
} };
const core = await startCore({ port: 4825, adapter, builtinPluginsDir: false, pluginsDir: join(root, "store"), recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json"), learnerDir: join(root, "learner") });
console.log("ready", core.url, project);
