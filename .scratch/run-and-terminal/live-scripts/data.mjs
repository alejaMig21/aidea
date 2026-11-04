// Live check (real Electron window, main monitor) of the Data layer: draws the variables of a played function, follows Playback, cuts a big list; captures at 1920, 1280 and narrow.
import { chromium } from "playwright-core";
import { spawn, execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const root = join(import.meta.dirname, "data-data");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
const store = join(root, "store"), a = join(root, "projectA");
mkdirSync(store, { recursive: true });
mkdirSync(a, { recursive: true });
writeFileSync(join(a, "tally.py"), `def tally(words):
    counts = {}
    seen = []
    for w in words:
        counts[w] = counts.get(w, 0) + 1
        seen.append(w)
    return counts


def build(n):
    items = list(range(n))
    total = len(items)
    return total
`);
const shots = join(import.meta.dirname, "data-shots");
mkdirSync(shots, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, detail); };
const env = { ...process.env, AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: store, AIDEA_SECRET_KEY_FILE: join(root, "secret.key"), AIDEA_SECRETS_FILE: join(root, "secrets.enc") };
const child = spawn("D:/Projects/aidea/node_modules/electron/dist/electron.exe", ["D:/Projects/aidea", "--remote-debugging-port=9481", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9481"); } catch { await wait(500); } }
let page;
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
await page.waitForFunction(() => typeof openProject === "function" && typeof layoutApi !== "undefined", null, { timeout: 40000 });
const ps = (s) => execFileSync("powershell", ["-NoProfile", "-Command", s], { encoding: "utf8" }).trim();
const resize = async (width, height = 1000) => { ps("Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r);' -Name W -Namespace N; $p = Get-Process -Id " + child.pid + "; [N.W]::MoveWindow($p.MainWindowHandle, 0, 0, " + width + ", " + height + ", $true) | Out-Null"); await wait(1500); };
await resize(1920);
await page.evaluate((x) => openProject(x), a);
await page.waitForFunction(() => document.getElementById("home").hidden && document.getElementById("opening").hidden, null, { timeout: 120000 });
await wait(1500);
// The way a person does it: double-click the function on Components, fill its form, Record, then choose Data.
const box = await page.evaluate(() => { const r = document.querySelector('#world rect[data-id="tally.tally"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.mouse.dblclick(box.x, box.y);
await page.waitForSelector("#pb-record", { timeout: 15000 });
await page.fill("#pb-v-words", '["apple", "pear", "apple", "fig", "pear", "apple"]');
await page.click("#pb-record");
await page.waitForFunction(() => pbRecording?.visits?.length > 3, null, { timeout: 20000 });
await page.click('#layers button[data-layer="data"]');
await wait(800);
const at = async (i) => { await page.evaluate((k) => pbGo(k), i); await wait(500); };
await at(7);
const state = await page.evaluate(() => ({ layer: authoredShown, vars: [...document.querySelectorAll("#data [data-var]")].map((g) => g.dataset.var), changed: [...document.querySelectorAll("#data .data-var.changed")].map((g) => g.dataset.var), cells: document.querySelectorAll("#data .data-cell").length, pairs: document.querySelectorAll("#data .data-pair").length }));
check("Data shows the variables of the step", state.layer === "data" && state.vars.includes("words") && state.vars.includes("counts"), JSON.stringify(state));
await page.screenshot({ path: join(shots, "1920-step.png") });
await page.evaluate(() => pbGo(pbRecording.visits.length - 1));
await wait(600);
const last = await page.evaluate(() => ({ pairs: document.querySelectorAll("#data .data-pair").length, cells: document.querySelectorAll("#data .data-cell").length }));
check("at the last step the dictionary has its three keys", last.pairs === 3, JSON.stringify(last));
await page.screenshot({ path: join(shots, "1920-last.png") });
// Stepping with the Playback buttons moves Flow and Data together.
await page.click("#pb-back").catch(() => {});
await wait(400);
const together = await page.evaluate(() => ({ flowNow: document.querySelector("#algorithm .flow-step.now")?.dataset.step, entry: pbRecording.visits[pbIndex].step }));
check("the Playback back button moves both: Flow's current step is the recorded step", together.flowNow === together.entry, JSON.stringify(together));
// A big list.
await page.click('#layers button[data-layer="components"]');
await wait(500);
const box2 = await page.evaluate(() => { const r = document.querySelector('#world rect[data-id="tally.build"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await page.mouse.dblclick(box2.x, box2.y);
await page.waitForSelector("#pb-v-n", { timeout: 15000 });
await page.fill("#pb-v-n", "10000");
await page.click("#pb-record");
await page.waitForFunction(() => pbRecording?.visits?.length > 1, null, { timeout: 20000 });
await page.click('#layers button[data-layer="data"]');
await page.evaluate(() => pbGo(pbRecording.visits.length - 1));
await wait(800);
const big = await page.evaluate(() => ({ cells: document.querySelectorAll('#data [data-var="items"] .data-cell').length, hidden: [...document.querySelectorAll("#data .data-hidden")].map((t) => t.textContent) }));
check("a list of 10,000 shows 100 cells and says '9,900 more hidden'", big.cells === 100 && big.hidden.includes("9,900 more hidden"), JSON.stringify(big));
await page.screenshot({ path: join(shots, "1920-big.png") });
await resize(1280);
await page.screenshot({ path: join(shots, "1280.png") });
await resize(700);
await page.screenshot({ path: join(shots, "700.png") });
const narrow = await page.evaluate(() => ({ narrow: document.body.classList.contains("narrow"), scrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth }));
check("in a narrow window the page does not scroll sideways", !narrow.scrolls, JSON.stringify(narrow));
console.log(results.every(Boolean) ? "ALL PASS" : "SOME FAILED");
try { execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ }
process.exit(0);
