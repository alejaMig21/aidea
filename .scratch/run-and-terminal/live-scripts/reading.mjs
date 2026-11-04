// Live check (real Electron window, second monitor) of the READING sign: files and Nodes select each other; one Node at a time.
import { chromium } from "playwright-core";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
const root = join(import.meta.dirname, "data-reading");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
const store = join(root, "store"), a = join(root, "projectA");
mkdirSync(store, { recursive: true });
cpSync("D:/Projects/aidea/test/fixtures/shop", a, { recursive: true });
const shots = join(import.meta.dirname, "reading-shots");
mkdirSync(shots, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, detail); };
const env = { ...process.env, AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: store, AIDEA_SECRET_KEY_FILE: join(root, "secret.key"), AIDEA_SECRETS_FILE: join(root, "secrets.enc") };
const child = spawn("D:/Projects/aidea/node_modules/electron/dist/electron.exe", ["D:/Projects/aidea", "--remote-debugging-port=9471", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9471"); } catch { await wait(500); } }
let page;
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
await page.waitForFunction(() => typeof openProject === "function" && typeof layoutApi !== "undefined", null, { timeout: 40000 });
await page.evaluate((x) => openProject(x), a);
await page.waitForFunction(() => document.getElementById("home").hidden && document.getElementById("opening").hidden, null, { timeout: 120000 });
await wait(1500);
const signs = () => page.evaluate(() => ({ rects: [...document.querySelectorAll("#world .reading[data-id]")].map((n) => n.getAttribute("data-id")), tags: [...document.querySelectorAll("#world .reading-tag")].map((n) => n.textContent) }));
// The real way: show Files and Code from the menu, click a file in the tree, click a Node on the Canvas.
for (const title of ["Files", "Code"]) { await page.click("#panels-button"); await page.click(`#panels-menu [data-title="${title}"]`); await page.keyboard.press("Escape"); await wait(500); }
await page.waitForSelector("#pane-files li[data-kind='file']", { timeout: 15000 });
await page.click("#pane-files li[data-path='cart.py'] .files-row");
await wait(800);
let s = await signs();
check("choosing cart.py in Files gives its Node the sign", s.rects.length > 0 && s.tags.length === 1 && s.tags[0] === "READING", JSON.stringify(s));
await page.screenshot({ path: join(shots, "1-file.png") });
await page.click("#pane-files li[data-path='main.py'] .files-row");
await wait(800);
const s2 = await signs();
check("choosing main.py moves it: one Node at a time", s2.tags.length === 1 && JSON.stringify(s2.rects) !== JSON.stringify(s.rects), JSON.stringify(s2));
// Click the class Node on the Canvas.
const classId = await page.evaluate(() => algoNodes.find((n) => n.kind === "class" && n.file === "cart.py").id);
const box = await page.evaluate((id) => { const r = document.querySelector(`#world rect.cp-class[data-id="${id}"]`).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, classId);
const expected = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.getAttribute("data-id"), box); // the Node under the pointer
await page.mouse.click(box.x, box.y);
await wait(1000);
const s3 = await signs();
check("clicking a Node on the Canvas shows its code and moves the sign to it", s3.rects.includes(expected) && s3.tags.length === 1, JSON.stringify(s3));
await page.screenshot({ path: join(shots, "2-node.png") });
console.log(results.every(Boolean) ? "ALL PASS" : "SOME FAILED");
try { execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ }
process.exit(0);
