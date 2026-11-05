// Live check of roles-and-contract 10, on the main monitor.
// Part 1, in Electron's own runtime: a stand-in Builder lists the tools of aidea's MCP and calls the one a plugin offers; a stand-in Tutor sees only the read-only one.
// Part 2: the real window starts with the plugin installed, and GET /plugins/inspect lists the tools.
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const root = join(import.meta.dirname, "agent-tools-data");
const electron = "D:/Projects/aidea/node_modules/electron/dist/electron.exe";
const rpcTo = (url) => (method, params, id) => fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
if (process.argv[2] === "inner") {
  const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
  const seen = { builder: null, tutor: null };
  const drive = async (url, into) => {
    const rpc = rpcTo(url);
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "live", version: "0" } }, 1);
    const tools = (await (await rpc("tools/list", {}, 2)).json()).result.tools.map((t) => t.name).filter((n) => n.startsWith("livetools_"));
    const call = async (name) => { const b = await (await rpc("tools/call", { name, arguments: { dish: "soup" } }, 3)).json(); return b.result ? b.result.content[0].text : "rpc error: " + b.error.message; };
    seen[into] = { tools, read: await call("livetools_read_menu"), clear: await call("livetools_clear_menu") };
  };
  const adapter = { options: { modes: [], models: [] }, run: async function* ({ permission, tools }) {
    if (permission) await drive(JSON.parse(permission.mcpConfig).mcpServers.aidea.url, "builder");
    else if (tools) await drive(JSON.parse(tools.mcpConfig).mcpServers.tutor.url, "tutor");
    yield { type: "text", text: "done" };
  } };
  const core = await startCore({ port: 0, adapter, pluginsDir: join(root, "plugins"), builtinPluginsDir: false });
  const post = (path, body) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  await post("/projects", { path: join(root, "project") });
  await (await post("/chat", { project: join(root, "project"), message: "go" })).text();
  await (await post("/tutor/classes", { project: join(root, "project"), topic: "x" })).text();
  console.log(JSON.stringify(seen));
  core.close();
  process.exit(0);
}
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
const dir = join(root, "plugins", "livetools");
mkdirSync(dir, { recursive: true });
mkdirSync(join(root, "project"), { recursive: true });
writeFileSync(join(root, "project", "app.py"), "def go():\n    return 1\n");
writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id: "livetools", version: "1.0.0", title: "Live tools", description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js" }));
writeFileSync(join(dir, "main.js"), [
  "export function activate(ctx) {",
  '  ctx.agents.tools.add({ name: "read_menu", description: "Reads the menu.", readOnly: true, inputSchema: { type: "object", properties: {} }, run: () => ({ dishes: ["soup", "bread"] }) });',
  '  ctx.agents.tools.add({ name: "clear_menu", description: "Clears a dish.", inputSchema: { type: "object", properties: { dish: { type: "string" } } }, run: (i) => ({ cleared: i.dish }) });',
  "}",
].join("\n"));
const inner = spawnSync(electron, [import.meta.filename, "inner"], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8", timeout: 120000 });
const seen = JSON.parse(inner.stdout.trim().split("\n").at(-1));
console.log(JSON.stringify(seen, null, 1));
const part1 = seen.builder.tools.length === 2 && /soup/.test(seen.builder.read) && /cleared/.test(seen.builder.clear) && seen.tutor.tools.join() === "livetools_read_menu" && /soup/.test(seen.tutor.read) && /rpc error/.test(seen.tutor.clear);
const { chromium } = createRequire("C:/Users/aleja/AppData/Local/Temp/claude/D--Projects-aidea/3af1c459-9050-4064-be0e-71c92620f6e0/scratchpad/live19/")("playwright-core");
const env = { ...process.env, AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: join(root, "plugins"), AIDEA_CACHE_DIR: join(root, "cache") };
const wait = (ms) => new Promise((x) => setTimeout(x, ms));
const child = spawn(electron, ["D:/Projects/aidea", "--remote-debugging-port=9387", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser, page;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9387"); } catch { await wait(500); } }
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
await page.waitForFunction(() => document.getElementById("guide-open"), null, { timeout: 40000 });
const inspect = await page.evaluate(async () => (await (await fetch("/plugins/inspect")).json()));
console.log("inspect agentTools:", JSON.stringify(inspect.agentTools.map((t) => [t.name, t.readOnly])));
child.kill();
const pass = part1 && inspect.agentTools.length === 2;
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
