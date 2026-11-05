// Live check of tutor-rewrite 02, on the main monitor. The real Tutor needs the person's Claude quota, so it is not started here.
// Part 1, in Electron's own runtime with a stand-in Tutor: it measures inside the session (two questions, one skipped with "I already know this"), hands over once, and the result is stored.
// Part 2: the real window: the Probe is gone (no route, no offer line, no script) and the page has no errors.
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const root = join(import.meta.dirname, "measure-data");
const electron = "D:/Projects/aidea/node_modules/electron/dist/electron.exe";
const project = join(root, "project");
if (process.argv[2] === "inner") {
  const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
  const seen = {};
  const adapter = { options: { modes: [], models: [] }, run: async function* ({ role, tools }) {
    if (role !== "tutor") return;
    const url = JSON.parse(tools.mcpConfig).mcpServers.tutor.url;
    const call = async (name, args) => (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) })).json()).result.content[0].text;
    const choice = (topic) => ({ topic, kind: "choice", prompt: `What is ${topic}?`, options: ["A box", "A wire", "A rule"], correct: "A box" });
    seen.q1 = await call("measure", choice("container"));
    seen.q2 = await call("measure", choice("boundary"));
    seen.done = await call("measure_done", { topics: [{ name: "container", floor: "Names a container.", ceiling: null, note: "Solid." }, { name: "boundary", floor: null, ceiling: "Has not met the word.", note: "New." }] });
    seen.again = await call("measure_done", { topics: [{ name: "x", floor: null, ceiling: null, note: "n" }] });
    yield { type: "text", text: "ok" };
  } };
  const core = await startCore({ port: 0, adapter, learnerDir: join(root, "learner"), recentsFile: join(root, "r.json"), preferencesFile: join(root, "p.json") });
  const post = (path, body) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  await post("/projects", { path: project });
  const res = await post("/tutor/classes", { project, message: "I want to understand this project" });
  let buf = "";
  for await (const chunk of res.body) {
    buf += Buffer.from(chunk).toString();
    const lines = buf.split("\n"); buf = lines.pop();
    for (const line of lines) {
      if (!line) continue;
      const e = JSON.parse(line);
      if (e.type === "tutor_question") await post("/tutor/answer", { id: e.id, secret: e.secret, ...(e.skippable && e.probe.n === 2 ? { skip: true } : e.kind === "choice" ? { option: 0, confidence: 90 } : { text: "x" }) });
    }
  }
  seen.stored = (await (await fetch(core.url + "/tutor/measure?project=" + encodeURIComponent(project))).json()).result;
  console.log(JSON.stringify(seen));
  core.close();
  process.exit(0);
}
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
mkdirSync(project, { recursive: true });
writeFileSync(join(project, "app.py"), "def go():\n    return 1\n");
const inner = spawnSync(electron, [import.meta.filename, "inner"], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, encoding: "utf8", timeout: 120000 });
const seen = JSON.parse(inner.stdout.trim().split("\n").at(-1));
console.log(JSON.stringify({ q2: seen.q2.slice(0, 120), again: seen.again.slice(0, 90), stored: seen.stored && { topics: seen.stored.topics.map((t) => t.name), questions: seen.stored.questions } }));
const part1 = /"correct":true/.test(seen.q1) && /"skipped":true/.test(seen.q2) && /ok/.test(seen.done) && /already handed over/.test(seen.again) && seen.stored.topics.length === 2 && seen.stored.questions === 2;
const { chromium } = createRequire("C:/Users/aleja/AppData/Local/Temp/claude/D--Projects-aidea/3af1c459-9050-4064-be0e-71c92620f6e0/scratchpad/live19/")("playwright-core");
const env = { ...process.env, AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner2"), AIDEA_PLUGINS_DIR: join(root, "plugins"), AIDEA_CACHE_DIR: join(root, "cache") };
const wait = (ms) => new Promise((x) => setTimeout(x, ms));
const child = spawn(electron, ["D:/Projects/aidea", "--remote-debugging-port=9389", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser, page;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9389"); } catch { await wait(500); } }
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e).split("\n").slice(0, 4).join(" | ")));
await page.waitForFunction(() => typeof openProject === "function" && typeof layoutApi !== "undefined", null, { timeout: 40000 });
await page.waitForLoadState("load"); await wait(1500); // the feature scripts load one after another: open the Project only when all are in
await page.evaluate(async (p) => { await openProject(p); }, project);
await page.waitForFunction(() => document.querySelector("#world rect"), null, { timeout: 20000 });
await wait(800);
const win = await page.evaluate(async () => ({
  probeUi: typeof window.probeUi, offer: !!document.getElementById("probe-offer"),
  probes: (await fetch("/tutor/probes?project=x&layer=flow")).status, measure: (await (await fetch("/tutor/measure?project=" + encodeURIComponent(document.title ? "" : ""))).json()).error ? "needs-a-project" : "ok",
  tutorStart: !!document.querySelector("#pane-tutor"),
}));
console.log(JSON.stringify({ win, errors }));
child.kill();
const pass = part1 && win.probeUi === "undefined" && !win.offer && win.probes === 404 && win.tutorStart && errors.length === 0;
console.log(pass ? "PASS" : "FAIL");
process.exit(pass ? 0 : 1);
