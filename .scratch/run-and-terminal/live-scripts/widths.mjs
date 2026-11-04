// Looks at the Layout at several window widths in the real window: are the layer tabs reachable, is any Panel cut, what order does Tab walk?
import { chromium } from "playwright-core";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
const root = join(import.meta.dirname, "data-widths");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
const store = join(root, "store"), a = join(root, "projectA");
mkdirSync(store, { recursive: true });
cpSync("D:/Projects/aidea/test/fixtures/shop", a, { recursive: true });
const shots = join(import.meta.dirname, "widths-shots");
mkdirSync(shots, { recursive: true });
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const env = { ...process.env, AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: store, AIDEA_SECRET_KEY_FILE: join(root, "secret.key"), AIDEA_SECRETS_FILE: join(root, "secrets.enc") };
const child = spawn("D:/Projects/aidea/node_modules/electron/dist/electron.exe", ["D:/Projects/aidea", "--remote-debugging-port=9451", `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
let browser;
for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP("http://127.0.0.1:9451"); } catch { await wait(500); } }
let page;
for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
await page.waitForFunction(() => typeof openProject === "function" && typeof layoutApi !== "undefined", null, { timeout: 40000 });
await page.evaluate((x) => openProject(x), a);
await page.waitForFunction(() => document.getElementById("home").hidden && document.getElementById("opening").hidden, null, { timeout: 120000 });
await wait(1500);
const ps = (s) => execFileSync("powershell", ["-NoProfile", "-Command", s], { encoding: "utf8" }).trim();
// Electron has no Browser.setWindowBounds: the window is moved with the system call (the window of this process, on the second monitor where it was put).
const resize = async (width) => { ps("Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int ht, bool r); [DllImport(\"user32.dll\")] public static extern bool GetWindowRect(IntPtr h, out int[] rc);' -Name W -Namespace N; $p = Get-Process -Id " + child.pid + "; $h = $p.MainWindowHandle; [N.W]::MoveWindow($h, 20, 20, " + width + ", 840, $true) | Out-Null"); await wait(1500); };
for (const width of [1920, 1280, 1100, 900, 700]) {
  await resize(width);
  const m = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const layers = document.getElementById("layers");
    const tabs = layers ? [...layers.children].map((c) => { const r = c.getBoundingClientRect(); return { t: c.textContent.trim().slice(0, 14), l: Math.round(r.left), r: Math.round(r.right) }; }) : [];
    const lr = layers?.getBoundingClientRect();
    const canvas = document.querySelector("main").getBoundingClientRect();
    return { vw, narrow: document.body.classList.contains("narrow"), groups: layoutApi.groups.map((g) => ({ p: g.panels.map((p) => p.id).join("+"), w: Math.round(g.element.getBoundingClientRect().width), right: Math.round(g.element.getBoundingClientRect().right) })), layersBox: lr ? { l: Math.round(lr.left), r: Math.round(lr.right), scroll: layers.scrollWidth > layers.clientWidth } : null, clipped: tabs.filter((t) => lr && (t.r > lr.right + 1 || t.l < lr.left - 1)).map((t) => t.t), canvas: { w: Math.round(canvas.width), h: Math.round(canvas.height) }, pageScrolls: document.documentElement.scrollWidth > vw };
  });
  console.log(width, JSON.stringify(m));
  await page.screenshot({ path: join(shots, `w${width}.png`) });
}
await resize(1280);
// The order Tab walks, by the group each stop is in.
await page.evaluate(() => document.activeElement?.blur());
const order = [];
for (let i = 0; i < 40; i++) {
  await page.keyboard.press("Tab");
  const stop = await page.evaluate(() => { const e = document.activeElement; const g = e?.closest?.(".dv-groupview"); const gi = g ? layoutApi.groups.findIndex((x) => x.element === g) : -1; const r = e?.getBoundingClientRect?.(); return { tag: (e?.tagName ?? "") + (e?.id ? "#" + e.id : "") + (e?.className && typeof e.className === "string" ? "." + e.className.split(" ")[0] : ""), group: gi >= 0 ? layoutApi.groups[gi].panels.map((p) => p.id).join("+") : null, x: r ? Math.round(r.left) : null, y: r ? Math.round(r.top) : null }; });
  order.push(`${stop.group ?? "-"}:${stop.tag}@${stop.x},${stop.y}`);
}
console.log("TAB ORDER:\n" + order.join("\n"));
try { execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ }
process.exit(0);
