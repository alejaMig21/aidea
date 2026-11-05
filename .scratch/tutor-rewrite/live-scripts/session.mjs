// Live check of tutor-rewrite 01, on the main monitor. The real Tutor needs the person's Claude quota, so it is not started here.
// Part 1, in Electron's own runtime with a stand-in Tutor: the question and the attached contexts reach it as one opening.
// Part 2: the real window: with no Open Project the Tutor says in plain words that it needs one; with one open, a question that is not text is refused.
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const root = join(import.meta.dirname, "session-data");
const electron = "D:/Projects/aidea/node_modules/electron/dist/electron.exe";
const project = join(root, "project");
if (process.argv[2] === "inner") {
  const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
  const openings = [];
  const adapter = { options: { modes: [], models: [] }, run: async function* ({ message, role }) { if (role === "tutor") openings.push(message); yield { type: "text", text: "ok" }; } };
  const core = await startCore({ port: 0, adapter, learnerDir: join(root, "learner"), recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json") });
  const post = (path, body) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  await post("/projects", { path: project });
  for (const body of [{ message: "How do I learn Rust ownership?" }, { guide: true, message: "What is the Canvas for?" }, { guide: true, selection: "x = 1", message: "Both" }]) await (await post("/tutor/classes", { project, ...body })).text();
  console.log(JSON.stringify(openings));
  core.close();
  process.exit(0);
}
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
mkdirSync(project, { recursive: true });
writeFileSync(join(project, "app.py"), "def go():\n    return 1\n");
const inner = spawnSync(electron, [import.meta.filename, "inner"], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8", timeout: 120000 });
const openings = JSON.parse(inner.stdout.trim().split("\n").at(-1));
console.log(JSON.stringify(openings.map((o) => o.slice(0, 90))));
const part1 = openings.length === 3 && /Rust ownership/.test(openings[0]) && /^The person asks: What is the Canvas for\?/.test(openings[1]) && /Both/.test(openings[2]) && /x = 1/.test(openings[2]) && /aidea/i.test(openings[2]);
const { chromium } = createRequire("C:/Users/aleja/AppData/Local/Temp/claude/D--Projects-aidea/3af1c459-9050-4064-be0e-71c92620f6e0/scratchpad/live19/")("playwright-core");
const env = { ...process.env, AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner2"), AIDEA_PLUGINS_DIR: join(root, "plugins"), AIDEA_CACHE_DIR: join(root, "cache") };
const wait = (ms) => new Promise((x) => setTimeout(x, ms));
const child = spawn(electron, ["D:/Projects/aidea", "--remote-debugging-port=9388", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser, page;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9388"); } catch { await wait(500); } }
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
await page.waitForFunction(() => typeof openProject === "function" && typeof layoutApi !== "undefined", null, { timeout: 40000 });
const post = (body) => page.evaluate(async (b) => { const r = await fetch("/tutor/classes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); return { status: r.status, body: await r.json().catch(() => null) }; }, body);
const noProject = await post({ message: "What is a queue?" });
await page.evaluate(async (p) => { await openProject(p); }, project);
await page.waitForFunction(() => document.querySelector("#world rect"), null, { timeout: 20000 });
const notText = await post({ project, message: 5 });
console.log(JSON.stringify({ noProject, notText }));
child.kill();
const pass = part1 && noProject.status === 400 && /open a project/i.test(noProject.body.error) && notText.status === 400 && /text/.test(notText.body.error);
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
