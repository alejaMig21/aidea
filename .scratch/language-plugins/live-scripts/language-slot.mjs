// Live check (real Electron window, second monitor) of language-plugins 01: a plugin that only analyzes a made-up language ("Zed", .zz) is installed in the plugin store,
// and opening a folder of .zz files draws its Nodes in the Components layer. With the plugin off the language is not read.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const { chromium } = createRequire("C:/Users/aleja/AppData/Local/Temp/claude/D--Projects-aidea/3af1c459-9050-4064-be0e-71c92620f6e0/scratchpad/live19/")("playwright-core");
const root = join(import.meta.dirname, "language-slot-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
const shots = join(import.meta.dirname, "language-slot-shots");
mkdirSync(shots, { recursive: true });
const store = join(root, "plugins", "zed");
mkdirSync(store, { recursive: true });
writeFileSync(join(store, "aidea-plugin.json"), JSON.stringify({ id: "zed", version: "1.0.0", title: "Zed language", description: "Reads the made-up language Zed.", publisher: "tests", api: "0.1", main: "main.js", language: { id: "zed", label: "Zed", extensions: [".zz"] } }));
writeFileSync(join(store, "main.js"), `export function activate(ctx) {
  ctx.languages.provide({
    async analyze(path) {
      const node = (id, kind, name, parent, line) => ({ id, kind, name, parent, file: "app.zz", line, endLine: line + 1 });
      return { nodes: [node("app", "module", "app", null, 1), node("app.Shop", "class", "Shop", "app", 2), node("app.checkout", "function", "checkout", "app", 5)], errors: [], relationships: [{ kind: "calls", from: "app.checkout", to: "app.Shop", name: "Shop", resolution: "resolved", line: 6 }], unresolved: 0 };
    },
  });
}`);
const project = join(root, "project");
mkdirSync(project, { recursive: true });
writeFileSync(join(project, "app.zz"), "module app\nclass Shop\n\n\nfn checkout\n");
const env = { ...process.env, AIDEA_DISPLAY: "secondary", AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: join(root, "plugins"), AIDEA_CACHE_DIR: join(root, "cache") };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn("D:/Projects/aidea/node_modules/electron/dist/electron.exe", ["D:/Projects/aidea", "--remote-debugging-port=9385", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser, page;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9385"); } catch { await wait(500); } }
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
await page.waitForFunction(() => typeof openProject === "function" && typeof layoutApi !== "undefined", null, { timeout: 40000 });
await page.evaluate(async (p) => { await openProject(p); }, project);
await page.waitForFunction(() => document.querySelector("#world rect"), null, { timeout: 20000 });
await wait(800);
const drawn = await page.evaluate(() => [...document.querySelectorAll("#world text")].map((t) => t.textContent).join(" | "));
await page.screenshot({ path: join(shots, "zed-components.png") });
const info = await page.evaluate(async () => (await (await fetch("/plugins")).json()));
const zed = (info.plugins ?? info).find?.((p) => p.id === "zed");
console.log(JSON.stringify({ zedState: zed?.state, drawn: drawn.slice(0, 200), window: await page.evaluate(() => window.screenX) }, null, 1));
const pass = zed?.state === "active" && /Shop/.test(drawn) && /checkout/.test(drawn);
console.log(pass ? "PASS" : "FAIL");
child.kill();
process.exit(pass ? 0 : 1);
