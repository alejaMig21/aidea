// Live check of plugin-teaching 02, in the real Electron runtime on the main monitor.
// Part 1: with Electron's own program as the runtime (what aidea uses to run a view), the Tutor's two tools read a view, run a check, and stop a view that writes, starts a program or reaches the network.
// Part 2: the real window starts with the plugin installed, and the plugin is active.
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { join } from "node:path";
const root = join(import.meta.dirname, "teach-tools-data");
const electron = "D:/Projects/aidea/node_modules/electron/dist/electron.exe";
if (process.argv[2] === "inner") {
  // Runs under ELECTRON_RUN_AS_NODE: Electron's runtime, as aidea's core has when it starts the child.
  const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
  const { runPluginTeachTool } = await import("file:///D:/Projects/aidea/src/core/plugins/teach.ts");
  const core = await startCore({ port: 0, pluginsDir: join(root, "plugins"), builtinPluginsDir: false });
  const call = async (name, args) => (await runPluginTeachTool(name, args, core)).text;
  let hits = 0;
  const server = createServer((_q, r) => { hits++; r.end("hi"); });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const out = {
    view: await call("read_plugin_view", { id: "livefix" }),
    yes: await call("check_plugin", { id: "livefix", name: "has-relation", args: { from: "shop", to: "db" } }),
    no: await call("check_plugin", { id: "livefix", name: "has-relation", args: { from: "db", to: "shop" } }),
    writes: await call("check_plugin", { id: "livefix", name: "writes" }),
    spawns: await call("check_plugin", { id: "livefix", name: "spawns" }),
    network: await call("check_plugin", { id: "livefix", name: "network", args: { port: server.address().port } }),
    hits, wrote: existsSync(join(root, "should-not-exist.txt")),
  };
  console.log(JSON.stringify(out));
  server.close(); core.close();
  process.exit(0);
}
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
const dir = join(root, "plugins", "livefix");
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id: "livefix", version: "1.0.0", title: "Live fixture", description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", teach: { view: "state", module: "teach.mjs", checks: [
  { name: "has-relation", says: "A relation between two Nodes exists.", args: { from: "string", to: "string" } },
  { name: "writes", says: "Tries to write a file." }, { name: "spawns", says: "Tries to start a program." }, { name: "network", says: "Tries to reach the network.", args: { port: "number" } }] } }));
writeFileSync(join(dir, "main.js"), "export function activate(ctx) { ctx.teach.state(() => ({ nodes: ['shop', 'db'], relations: [['shop', 'db']] })); }");
writeFileSync(join(dir, "teach.mjs"), [
  'import { writeFileSync } from "node:fs";',
  'import { execSync } from "node:child_process";',
  "export const view = (s) => ({ nodes: s.nodes });",
  "export const checks = {",
  '  "has-relation": (s, a) => { const f = s.relations.some(([x, y]) => x === a.from && y === a.to); return { ok: f, reason: f ? "The relation exists." : "There is no such relation." }; },',
  `  writes: () => { writeFileSync(${JSON.stringify(join(root, "should-not-exist.txt"))}, "x"); return { ok: true }; },`,
  '  spawns: () => { execSync("echo hi"); return { ok: true }; },',
  '  network: (s, a) => fetch("http://127.0.0.1:" + a.port + "/").then(() => ({ ok: true })),',
  "};",
].join("\n"));
const inner = spawnSync(electron, [import.meta.filename, "inner"], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8", timeout: 120000 });
const r = JSON.parse(inner.stdout.trim().split("\n").at(-1));
console.log(JSON.stringify({ view: r.view.slice(0, 160), yes: r.yes.slice(0, 160), no: r.no.slice(0, 160), writes: r.writes, spawns: r.spawns, network: r.network, hits: r.hits, wrote: r.wrote }, null, 1));
const part1 = /"nodes":\["shop","db"\]/.test(r.view) && /"ok":true/.test(r.yes) && /"ok":false/.test(r.no) && /may not do/.test(r.writes) && /may not do/.test(r.spawns) && /network/.test(r.network) && r.hits === 0 && !r.wrote;
// Part 2: the real window (main monitor), the plugin is active.
const { chromium } = createRequire("C:/Users/aleja/AppData/Local/Temp/claude/D--Projects-aidea/3af1c459-9050-4064-be0e-71c92620f6e0/scratchpad/live19/")("playwright-core");
const env = { ...process.env, AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: join(root, "plugins"), AIDEA_CACHE_DIR: join(root, "cache") };
const wait = (ms) => new Promise((x) => setTimeout(x, ms));
const child = spawn(electron, ["D:/Projects/aidea", "--remote-debugging-port=9386", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser, page;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9386"); } catch { await wait(500); } }
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
await page.waitForFunction(() => document.getElementById("guide-open"), null, { timeout: 40000 });
const info = await page.evaluate(async () => (await (await fetch("/plugins")).json()));
const mine = (info.plugins ?? info).find((p) => p.id === "livefix");
console.log("window plugin state:", mine?.state);
child.kill();
const pass = part1 && mine?.state === "active";
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
