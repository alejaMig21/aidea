// Looks at the Layout at several window widths in the real window: are the layer tabs reachable, is any Panel cut, what order does Tab walk?
import { chromium } from "playwright-core";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
const root = join(import.meta.dirname, "data-keys");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
const store = join(root, "store"), a = join(root, "projectA");
mkdirSync(store, { recursive: true });
cpSync("D:/Projects/aidea/test/fixtures/shop", a, { recursive: true });
const shots = join(import.meta.dirname, "keys-shots");
mkdirSync(shots, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const env = { ...process.env, AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: store, AIDEA_SECRET_KEY_FILE: join(root, "secret.key"), AIDEA_SECRETS_FILE: join(root, "secrets.enc") };
const child = spawn("D:/Projects/aidea/node_modules/electron/dist/electron.exe", ["D:/Projects/aidea", "--remote-debugging-port=9461", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9461"); } catch { await wait(500); } }
let page;
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
await page.waitForFunction(() => typeof openProject === "function" && typeof layoutApi !== "undefined", null, { timeout: 40000 });
await page.evaluate((x) => openProject(x), a);
await page.waitForFunction(() => document.getElementById("home").hidden && document.getElementById("opening").hidden, null, { timeout: 120000 });
await wait(1500);
const ps = (s) => execFileSync("powershell", ["-NoProfile", "-Command", s], { encoding: "utf8" }).trim();
// Electron has no Browser.setWindowBounds: the window is moved with the system call (the window of this process, on the second monitor where it was put).
const resize = async (width) => { ps("Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r); [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr h, out int[] rc);' -Name W -Namespace N; $p = Get-Process -Id " + child.pid + "; $h = $p.MainWindowHandle; [N.W]::MoveWindow($h, 20, 20, " + width + ", 840, $true) | Out-Null"); await wait(1500); };

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, detail); };
const names = () => page.evaluate(() => layoutApi.groups.filter((g) => g.panels.length).sort((a, b) => a.element.getBoundingClientRect().left - b.element.getBoundingClientRect().left).map((g) => g.panels.map((p) => p.id).join("+")));
const where = () => page.evaluate(() => { const a = document.activeElement; const g = layoutApi.groups.find((x) => x.element.contains(a) || x.panels.some((p) => layoutEl(p.id).contains(a))); return { group: g ? g.panels.map((p) => p.id).join("+") : null, role: a?.getAttribute?.("role"), label: a?.getAttribute?.("aria-label") }; });
const widths = () => page.evaluate(() => layoutApi.groups.filter((g) => g.panels.length).sort((a, b) => a.element.getBoundingClientRect().left - b.element.getBoundingClientRect().left).map((g) => Math.round(g.element.getBoundingClientRect().width)));
await resize(1100);
const layers = await page.evaluate(() => { const l = document.getElementById("layers"); const b = l.getBoundingClientRect(); return { scrolls: l.scrollWidth > l.clientWidth + 1, outside: [...l.querySelectorAll("button[data-layer]")].filter((x) => { const r = x.getBoundingClientRect(); return r.right > b.right + 1; }).length, rows: new Set([...l.children].map((c) => Math.round(c.getBoundingClientRect().top))).size }; });
check("at 1100 the layer tabs are all inside the bar, with no sideways scroll", !layers.scrolls && layers.outside === 0, JSON.stringify(layers));
await page.screenshot({ path: join(shots, "1100.png") });
await page.mouse.click(5, 400); // focus leaves the controls
await page.keyboard.press("F6");
const f1 = await where();
await page.keyboard.press("F6");
const f2 = await where();
check("F6 moves between the Panels with a real key", f1.group === "chat" && f2.group === "canvas", JSON.stringify([f1, f2]));
await page.screenshot({ path: join(shots, "f6-ring.png") });
// Tab with real keys from the Builder tab: every stop belongs to the group it should, left to right.
await page.keyboard.press("Shift+F6");
const seq = [];
for (let i = 0; i < 60; i++) { await page.keyboard.press("Tab"); const w = await where(); seq.push(w.role === "separator" ? "sash" : w.group); }
const order = seq.filter((x, i) => x !== seq[i - 1]);
console.log("tab sequence", order.join(" > "));
const monotone = order.filter((x) => x !== "sash" && x !== null);
check("real Tab walks the Panels in screen order (Builder, Canvas, Tutor)", JSON.stringify(monotone.slice(0, 3)) === JSON.stringify(["chat", "canvas", "right"]), monotone.join(" > "));
// A border by keyboard: reach it with Tab, move it with the arrows.
await page.mouse.click(5, 400);
await page.keyboard.press("F6");
let onSash = false;
for (let i = 0; i < 60 && !onSash; i++) { await page.keyboard.press("Tab"); onSash = (await where()).role === "separator"; }
check("Tab reaches a border", onSash);
const w0 = await widths();
for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
const w1 = await widths();
check("three arrow presses move the border 60px and only its two neighbours change", w1[0] - w0[0] >= 55 && w1[0] - w0[0] <= 65 && w1[2] === w0[2], JSON.stringify([w0, w1]));
await page.screenshot({ path: join(shots, "sash.png") });
// Moving a Panel with the keyboard.
await page.mouse.click(5, 400);
await page.keyboard.press("Shift+F6"); // the Tutor
const before = await names();
await page.keyboard.press("Alt+Shift+ArrowLeft");
await wait(600);
const after = await names();
check("Alt+Shift+Left moves the Tutor to the left of the Canvas", JSON.stringify(before) === JSON.stringify(["chat", "canvas", "right"]) && JSON.stringify(after) === JSON.stringify(["chat", "right", "canvas"]), JSON.stringify([before, after]));
await page.screenshot({ path: join(shots, "moved.png") });
await page.keyboard.press("Alt+Shift+Enter");
await wait(600);
const tabbed = await names();
check("Alt+Shift+Enter puts it in the tabs of the Builder", JSON.stringify(tabbed) === JSON.stringify(["chat+right", "canvas"]), JSON.stringify(tabbed));
await page.screenshot({ path: join(shots, "tabbed.png") });
await resize(700);
const narrow = await page.evaluate(() => ({ narrow: document.body.classList.contains("narrow"), pageScrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth, layersOutside: [...document.querySelectorAll("#layers button[data-layer]")].filter((b) => b.getBoundingClientRect().right > document.getElementById("layers").getBoundingClientRect().right + 1).length }));
check("at 700 the window is narrow (drawers), the page does not scroll sideways and the layer tabs fit", narrow.narrow && !narrow.pageScrolls && narrow.layersOutside === 0, JSON.stringify(narrow));
await page.screenshot({ path: join(shots, "700.png") });
console.log(results.every(Boolean) ? "ALL PASS" : "SOME FAILED");
try { execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ }
process.exit(0);
