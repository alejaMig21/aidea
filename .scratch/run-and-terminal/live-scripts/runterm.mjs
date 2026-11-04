// Live check (real Electron window, second monitor) of run-and-terminal 08, 11, 12 and 13: env vars by name, terminal selection limits, Fix buttons, secret warning.
// Buttons that would call a real model (Explain, Fix) are never pressed: only what the window shows and what it asks first is checked.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const root = join(import.meta.dirname, "data-runterm");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
const store = join(root, "store"), project = join(root, "project");
mkdirSync(store, { recursive: true });
cpSync("D:/Projects/aidea/test/fixtures/shop", project, { recursive: true });
writeFileSync(join(project, "talk.js"), 'for (let i = 0; i < 400; i++) console.log("line " + i + " " + "y".repeat(30)); console.log("DB_PASSWORD=hunter2hunter2"); setInterval(() => {}, 1000);');
writeFileSync(join(project, "needs.js"), 'console.log("never reached");');
writeFileSync(join(project, ".env"), "OTHER=1\n");
mkdirSync(join(project, ".aidea"), { recursive: true });
const recipe = (parts) => writeFileSync(join(project, ".aidea", "run.json"), JSON.stringify({ parts }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shots = join(import.meta.dirname, "runterm-shots");
mkdirSync(shots, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, detail); };
const env = { ...process.env, AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: store, AIDEA_DISPLAY: "secondary" };
const child = spawn("D:/Projects/aidea/node_modules/electron/dist/electron.exe", ["D:/Projects/aidea", "--remote-debugging-port=9391", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9391"); } catch { await wait(500); } }
let page;
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
await page.waitForFunction(() => typeof openProject === "function" && typeof layoutApi !== "undefined", null, { timeout: 40000 });
const nativeDialogs = [];
page.on("dialog", async (d) => { nativeDialogs.push(d.message()); await d.dismiss(); });
await page.evaluate((x) => openProject(x), project);
await page.waitForFunction(() => document.getElementById("home").hidden && document.getElementById("opening").hidden, null, { timeout: 120000 });
await wait(1500);
const PLAY = '[data-topbar-plugin="run.play"]';
const note = () => page.locator(PLAY + " [role=status]").textContent();
const accept = async () => { await page.waitForSelector("#dialog-layer .dialog", { timeout: 15000 }); await page.click("#dialog-layer button.primary"); await page.waitForSelector("#dialog-layer", { state: "detached", timeout: 5000 }); };
const visibleButtons = () => page.evaluate(() => [...document.querySelectorAll("#select-pop button")].filter((b) => !b.closest("[hidden]") && !b.hidden).map((b) => b.textContent));
const pressButton = (label) => page.evaluate((l) => [...document.querySelectorAll("#select-pop button")].find((b) => b.textContent === l)?.click(), label);

try {
  // 08: a part lists a variable that the project's .env does not hold: it fails by name before it starts.
  recipe([{ name: "needs", command: "node needs.js", env: ["API_KEY"] }]);
  await page.click(PLAY + " button");
  await accept();
  await page.waitForFunction((s) => /API_KEY/.test(document.querySelector(s + " [role=status]").textContent), PLAY, { timeout: 15000 });
  check("08 a missing variable is named in Play's note", /API_KEY/.test(await note()), await note());
  await page.screenshot({ path: join(shots, "08-missing-variable.png") });
  // Now a recipe that runs and talks.
  recipe([{ name: "talk", command: "node talk.js" }]);
  await page.click(PLAY + " button");
  await accept();
  await page.click("#panels-button");
  await page.click('#panels-menu [data-title="Terminal"]');
  await page.click("#panels-button");
  await page.waitForFunction(() => /DB_PASSWORD/.test(document.querySelector("pre[data-selection-source=terminal]")?.textContent ?? ""), null, { timeout: 20000 });
  await wait(1800);
  const log = page.locator("pre[data-selection-source=terminal]");
  // 11 and 12: a long selection with the real mouse and keyboard (click, then Shift+Ctrl+End): the control says it cut the start and offers four buttons.
  await log.click({ position: { x: 20, y: 10 } });
  await page.evaluate(() => { const pre = document.querySelector("pre[data-selection-source=terminal]"); pre.scrollTop = pre.scrollHeight; });
  const box = await log.boundingBox();
  await log.click({ position: { x: 200, y: box.height - 8 }, modifiers: ["Shift"] }); // shift-click extends the selection from the first click to here
  await wait(600);
  const pop = await page.evaluate(() => { const p = document.getElementById("select-pop"); return { shown: !p.hidden, hint: p.querySelector(".hint").hidden ? "" : p.querySelector(".hint").textContent, len: getSelection().toString().length }; });
  const buttons = await visibleButtons();
  console.log("selection length", pop.len, "shown", pop.shown);
  check("12 four buttons in the terminal", JSON.stringify(buttons) === JSON.stringify(["Explain", "Fix", "Explain and fix", "Enter the Tutor"]), buttons.join(", "));
  check("11 a selection over 8000 characters says it cut the start", pop.len > 8000 && /last 8000/.test(pop.hint), pop.hint + " (len " + pop.len + ")");
  await page.screenshot({ path: join(shots, "11-12-terminal-selection.png") });
  // 13: a line that is a secret: pressing Fix asks first, and Cancel sends nothing.
  await page.evaluate(() => { const pre = document.querySelector("pre[data-selection-source=terminal]"); pre.scrollTop = pre.scrollHeight; const t = pre.firstChild; const i = t.textContent.indexOf("DB_PASSWORD"); const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 26); getSelection().removeAllRanges(); getSelection().addRange(r); document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true })); });
  await wait(600);
  const chatsBefore = await page.evaluate(() => document.querySelectorAll("#chat-log .you").length);
  await pressButton("Fix");
  await wait(400);
  const warn = await page.evaluate(() => { const w = document.querySelector("#select-pop .warn"); return { shown: !w.hidden, text: w.textContent }; });
  check("13 a secret asks before it sends", warn.shown && /looks like a secret/.test(warn.text), warn.text.slice(0, 60));
  await page.screenshot({ path: join(shots, "13-secret-warning.png") });
  await pressButton("Cancel");
  await wait(300);
  const chatsAfter = await page.evaluate(() => document.querySelectorAll("#chat-log .you").length);
  check("13 Cancel sends nothing", chatsAfter === chatsBefore);
  // Outside the terminal and the Code panel only two buttons.
  await page.evaluate(() => { const b = document.createElement("div"); b.id = "x-other"; b.textContent = "some text outside the terminal"; document.getElementById("chat-log").append(b); const r = document.createRange(); r.selectNodeContents(b); getSelection().removeAllRanges(); getSelection().addRange(r); document.dispatchEvent(new MouseEvent("mouseup", { bubbles: true })); });
  await wait(500);
  const other = await visibleButtons();
  check("12 two buttons outside the terminal and the Code panel", JSON.stringify(other) === JSON.stringify(["Explain", "Enter the Tutor"]), other.join(", "));
  check("no native confirm dialog appeared", nativeDialogs.length === 0, nativeDialogs.join(" | "));
} catch (e) { check("script error", false, String(e).slice(0, 300)); }
await page.evaluate(() => fetch("/plugins/run/call/stopAll", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).catch(() => {});
child.kill();
console.log(results.every(Boolean) ? "ALL PASS" : "SOME FAILED");
process.exit(0);
