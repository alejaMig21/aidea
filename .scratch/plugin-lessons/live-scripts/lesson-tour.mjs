// Live check (real Electron window, second monitor) of plugin-lessons 01: the quick tour of "How aidea works" ends with the lesson of the Terminal plugin.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
const { chromium } = createRequire("C:/Users/aleja/AppData/Local/Temp/claude/D--Projects-aidea/3af1c459-9050-4064-be0e-71c92620f6e0/scratchpad/live19/")("playwright-core");
const root = join(import.meta.dirname, "lesson-tour-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
mkdirSync(root, { recursive: true });
const shots = join(import.meta.dirname, "lesson-tour-shots");
mkdirSync(shots, { recursive: true });
const env = { ...process.env, AIDEA_DISPLAY: "secondary", AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: join(root, "plugins"), AIDEA_CACHE_DIR: join(root, "cache") };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const child = spawn("D:/Projects/aidea/node_modules/electron/dist/electron.exe", ["D:/Projects/aidea", "--remote-debugging-port=9383", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser, page;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9383"); } catch { await wait(500); } }
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
await page.waitForFunction(() => document.getElementById("guide-open"), null, { timeout: 40000 });
await wait(1500);
await page.evaluate(() => document.getElementById("guide-open").click());
await page.waitForFunction(() => !document.getElementById("layer-tour").hidden, null, { timeout: 10000 });
const titles = [];
for (let i = 0; i < 40; i++) {
  titles.push(await page.locator("#layer-tour").evaluate((t) => t.firstElementChild.textContent));
  const next = page.locator("#layer-tour button", { hasText: /^(Next|Finish)$/ });
  if ((await next.textContent()) === "Finish") break;
  await next.evaluate((b) => b.click());
  await wait(80);
}
await page.screenshot({ path: join(shots, "last-step.png") });
const bounds = await page.evaluate(() => ({ x: window.screenX, y: window.screenY, w: window.innerWidth }));
console.log(JSON.stringify({ titles: titles.slice(-3), count: titles.length, window: bounds }, null, 1));
const pass = /Terminal: Asking about a line/.test(titles.at(-1)) && /Terminal: The Terminal strip/.test(titles.at(-2)) && bounds.x >= 1500 /* 1920 px at 125% screen scale */;
console.log(pass ? "PASS" : "FAIL");
child.kill();
process.exit(pass ? 0 : 1);
