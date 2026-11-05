// Serves aidea's real core and interface (with the plugins that ship with it) on http://127.0.0.1:4823 with a stand-in Tutor that reads the view of the Terminal and runs its check.
// In the page: accept the run recipe, press Play, then Start a class; the stand-in says what the Terminal's tabs held.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
const root = join(import.meta.dirname, "serve-terminal-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 });
const project = join(root, "shop");
mkdirSync(join(project, ".aidea"), { recursive: true });
writeFileSync(join(project, "app.py"), "def go():\n    return 1\n");
writeFileSync(join(project, ".aidea", "run.json"), JSON.stringify({ parts: [{ name: "hello", command: "node -e \"console.log('hello from the part')\"" }] }));
const adapter = { options: { modes: [], models: [] }, run: async function* ({ role, tools }) {
  if (role !== "tutor") return;
  const url = JSON.parse(tools.mcpConfig).mcpServers.tutor.url;
  const call = async (name, args) => JSON.parse((await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) })).json()).result.content[0].text);
  const view = await call("read_plugin_view", { id: "terminal" });
  const check = await call("check_plugin", { id: "terminal", name: "program-wrote", args: { program: "hello" } });
  yield { type: "text", text: `Tabs: ${view.view.tabs.map((t) => `${t.name} [${t.lastLines.join(" / ")}]`).join(", ") || "none"}. Check: ${check.result.ok ? "the program wrote something" : check.result.reason}` };
} };
const core = await startCore({ port: 4823, adapter, pluginsDir: join(root, "store"), recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json"), learnerDir: join(root, "learner") });
console.log("ready", core.url, project);
