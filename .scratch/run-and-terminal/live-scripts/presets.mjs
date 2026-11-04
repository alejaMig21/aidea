// Live check (real Electron window, second monitor) of layout presets: built-in layouts, saving under a name, surviving a close and reopen, and a layout for each Project.
import { chromium } from "playwright-core";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "data-presets");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
const store = join(root, "store"), a = join(root, "projectA"), b = join(root, "projectB");
mkdirSync(store, { recursive: true });
for (const p of [a, b]) cpSync("D:/Projects/aidea/test/fixtures/shop", p, { recursive: true });
const shots = join(import.meta.dirname, "presets-shots");
mkdirSync(shots, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, detail); };
const env = { ...process.env, AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: store, AIDEA_DISPLAY: "secondary", AIDEA_SECRET_KEY_FILE: join(root, "secret.key"), AIDEA_SECRETS_FILE: join(root, "secrets.enc") };
const stop = async (child) => { try { execFileSync("taskkill", ["/pid", String(child.pid)], { stdio: "ignore" }); } catch { /* gone */ } for (let i = 0; i < 40 && child.exitCode === null; i++) await wait(250); if (child.exitCode === null) { try { execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ } } await wait(1500); };
async function launch(port) {
  const child = spawn("D:/Projects/aidea/node_modules/electron/dist/electron.exe", ["D:/Projects/aidea", `--remote-debugging-port=${port}`, `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
  let browser;
  for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch { await wait(500); } }
  let page;
  for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
  await page.waitForFunction(() => typeof openProject === "function" && typeof layoutApi !== "undefined", null, { timeout: 40000 });
  return { child, page };
}
const open = async (page, p) => { await page.evaluate((x) => openProject(x), p); await page.waitForFunction(() => document.getElementById("home").hidden && document.getElementById("opening").hidden, null, { timeout: 120000 }); await wait(1500); };
const menu = async (page) => { if (await page.locator("#panels-menu").isHidden()) await page.click("#panels-button"); await wait(200); };
const choose = async (page, name) => { await menu(page); await page.click(`#panels-menu [data-preset="${name}"]`); await wait(900); };
const on = async (page) => { await menu(page); const r = await page.evaluate(() => [...document.querySelectorAll("#panels-menu [role=menuitemcheckbox][data-panel]")].filter((x) => x.getAttribute("aria-checked") === "true").map((x) => x.dataset.panel).sort()); await page.keyboard.press("Escape"); return r; };

let one = await launch(9431);
await open(one.page, a);
await menu(one.page);
await one.page.screenshot({ path: join(shots, "1-menu.png") });
await one.page.keyboard.press("Escape");
await choose(one.page, "Classic IDE");
const classic = await on(one.page);
check("Classic IDE shows Builder, Files, Code and the Canvas, not the Tutor", ["chat", "files", "code", "canvas"].every((x) => classic.includes(x)) && !classic.includes("right"), classic.join());
await one.page.screenshot({ path: join(shots, "2-classic.png") });
// Save it under a name through the dialog, with the keyboard for the text.
await menu(one.page);
await one.page.click('#panels-menu [data-action="save"]');
await one.page.waitForSelector(".dialog-layer input", { timeout: 5000 });
await one.page.fill(".dialog-layer input", "Default");
await one.page.keyboard.press("Enter");
await wait(300);
const refused = await one.page.locator(".dialog-error").textContent();
check("a built-in name is refused by saying why", /built-in/i.test(refused), refused);
await one.page.screenshot({ path: join(shots, "3-save-dialog.png") });
await one.page.fill(".dialog-layer input", "My work");
await one.page.keyboard.press("Enter");
await one.page.waitForSelector(".dialog-layer", { state: "detached", timeout: 5000 });
await choose(one.page, "Canvas only");
check("Canvas only hides every Panel", (await on(one.page)).filter((x) => x !== "canvas").length === 0);
await stop(one.child);

// Closed and reopened: the layout is still there.
let two = await launch(9432);
await open(two.page, a);
await menu(two.page);
const names = await two.page.evaluate(() => [...document.querySelectorAll("#panels-menu [data-preset]")].map((x) => x.dataset.preset));
check("after reopening aidea 'My work' is still in the menu", names.includes("My work"), names.join());
await two.page.keyboard.press("Escape");
await choose(two.page, "My work");
const back = await on(two.page);
check("choosing it brings the Classic arrangement back", JSON.stringify(back) === JSON.stringify(classic), back.join());

// A layout for each Project.
await menu(two.page);
await two.page.click('#panels-menu [data-action="scope"]');
await wait(500);
await choose(two.page, "Classic IDE");
await open(two.page, b);
const bStart = await on(two.page);
check("a Project with no layout of its own starts from the one on screen", JSON.stringify(bStart) === JSON.stringify(classic), bStart.join());
await choose(two.page, "Canvas only");
await open(two.page, a);
const aBack = await on(two.page);
check("reopening the first Project brings its own layout back", JSON.stringify(aBack) === JSON.stringify(classic), aBack.join());
await open(two.page, b);
const bBack = await on(two.page);
check("and the second keeps its own", bBack.filter((x) => x !== "canvas").length === 0, bBack.join());
await two.page.screenshot({ path: join(shots, "4-project-b.png") });
await stop(two.child);
console.log(results.every(Boolean) ? "ALL PASS" : "SOME FAILED");
process.exit(0);
