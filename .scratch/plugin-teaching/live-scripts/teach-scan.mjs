// Live check (real Electron window, second monitor) of plugin-teaching 01: a plugin whose manifest declares `teach` reaches the quarantine and its scan lists the view and the checks; a bad one is refused with the field named.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { chromium } = createRequire("C:/Users/aleja/AppData/Local/Temp/claude/D--Projects-aidea/3af1c459-9050-4064-be0e-71c92620f6e0/scratchpad/live19/")("playwright-core");
const root = join(import.meta.dirname, "teach-scan-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
mkdirSync(root, { recursive: true });
const plugin = (name, teach) => {
  const dir = join(root, "src", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id: `fixture.${name}`, version: "1.0.0", title: name, description: "A fixture.", publisher: "tests", api: "0.1", ui: "ui.js", teach }));
  writeFileSync(join(dir, "ui.js"), "// nothing");
  return dir;
};
const good = plugin("good", { view: "state", checks: [{ name: "has-container", says: "A container with a relation to a database exists.", args: { node: "string" } }] });
const bad = plugin("bad", { view: "state", checks: [{ name: "has-container", says: "" }] });
const env = { ...process.env, AIDEA_DISPLAY: "secondary", AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: join(root, "plugins"), AIDEA_CACHE_DIR: join(root, "cache") };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn("D:/Projects/aidea/node_modules/electron/dist/electron.exe", ["D:/Projects/aidea", "--remote-debugging-port=9384", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser, page;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9384"); } catch { await wait(500); } }
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
await page.waitForFunction(() => document.getElementById("guide-open"), null, { timeout: 40000 });
const post = (source) => page.evaluate(async (s) => { const r = await fetch("/plugins/quarantine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: s }) }); return { status: r.status, body: await r.json() }; }, source);
const a = await post(good), b = await post(bad);
const scanOf = (x) => x.body.report ?? x.body.scan ?? x.body;
const teach = scanOf(a).manifest?.teach;
const refused = JSON.stringify(scanOf(b).findings ?? scanOf(b));
console.log(JSON.stringify({ goodStatus: a.status, teach, badStatus: b.status, refused: refused.slice(0, 200), window: await page.evaluate(() => window.screenX) }, null, 1));
const pass = teach?.view === "state" && teach.checks[0].name === "has-container" && /says/.test(refused) && /invalid-manifest/.test(refused);
console.log(pass ? "PASS" : "FAIL");
child.kill();
process.exit(pass ? 0 : 1);
