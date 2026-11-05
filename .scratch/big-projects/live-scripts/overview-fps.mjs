// Live check (real Electron window, second monitor) of big-projects 02: frames per second moving the Components overview of Telegram, with its test modules closed and open.
// Usage: node overview-fps.mjs [label]. playwright-core is loaded from the scratch folder that has it.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
const { chromium } = createRequire("C:/Users/aleja/AppData/Local/Temp/claude/D--Projects-aidea/3af1c459-9050-4064-be0e-71c92620f6e0/scratchpad/live19/")("playwright-core");
const label = process.argv[2] ?? "run";
const project = "D:/Projects/Telegram";
const root = join(import.meta.dirname, "overview-fps-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
mkdirSync(root, { recursive: true });
const shots = join(import.meta.dirname, "overview-fps-shots");
mkdirSync(shots, { recursive: true });
const env = { ...process.env, AIDEA_DISPLAY: "secondary", AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: join(root, "store"), AIDEA_CACHE_DIR: join(root, "cache") };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn("D:/Projects/aidea/node_modules/electron/dist/electron.exe", ["D:/Projects/aidea", "--remote-debugging-port=9383", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser, page;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9383"); } catch { await wait(500); } }
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
await page.waitForFunction(() => typeof openProject === "function" && typeof layoutApi !== "undefined", null, { timeout: 40000 });
await page.evaluate((p) => openProject(p), project);
await page.waitForFunction(() => document.getElementById("home").hidden && document.getElementById("opening").hidden && document.querySelector("#world rect"), null, { timeout: 120000 });
await wait(1500);
const measure = () => page.evaluate(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const fps = (ms) => new Promise((res) => { let n = 0, t0 = performance.now(); const tick = (t) => { view.x += n % 2 ? 4 : -4; apply(); n++; if (t - t0 < ms) requestAnimationFrame(tick); else res(Math.round(n / ((t - t0) / 1000))); }; requestAnimationFrame(tick); });
  $("zoom-fit").click();
  await wait(400);
  const runs = [];
  for (let i = 0; i < 3; i++) runs.push(await fps(1500));
  return { elements: document.querySelectorAll("#world *").length, edges: document.querySelectorAll("#world .cp-ov-edge").length, fps: Math.max(...runs), runs };
});
const result = { label, closed: await measure() };
await page.screenshot({ path: join(shots, `${label}-closed.png`) });
await page.evaluate(() => componentsToggleTests());
await wait(2500);
result.open = await measure();
await page.screenshot({ path: join(shots, `${label}-tests-open.png`) });
console.log(JSON.stringify(result));
child.kill();
process.exit(0);
