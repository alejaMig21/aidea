// Live check (real Electron window, second monitor): closing and restarting aidea while Play has parts running.
// The native question box is driven with UI Automation: focus the button and press Space.
import { chromium } from "playwright-core";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer, connect } from "node:net";
import { join } from "node:path";

const root = join(import.meta.dirname, "data-lifecycle");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
const store = join(root, "store"), project = join(root, "project");
mkdirSync(store, { recursive: true });
cpSync("D:/Projects/aidea/test/fixtures/shop", project, { recursive: true });
const port = await new Promise((r) => { const s = createServer().listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => r(p)); }); });
writeFileSync(join(project, "db.js"), `require("net").createServer().listen(${port}, "127.0.0.1"); setInterval(() => {}, 1000);`);
mkdirSync(join(project, ".aidea"), { recursive: true });
writeFileSync(join(project, ".aidea", "run.json"), JSON.stringify({ parts: [{ name: "db", command: "node db.js", ready: { port } }] }));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const answers = (p) => new Promise((res) => { const c = connect(p, "127.0.0.1"); c.on("connect", () => { c.destroy(); res(true); }); c.on("error", () => res(false)); });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, detail); };
const env = { ...process.env, AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: store, AIDEA_SECRET_KEY_FILE: join(root, "secret.key"), AIDEA_SECRETS_FILE: join(root, "secrets.enc") };
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const ps = (script) => execFileSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" }).trim();
const find = (pid, name) => `$c = New-Object Windows.Automation.AndCondition((New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::ProcessIdProperty, ${pid})), (New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty, '${name}'))); $b = [Windows.Automation.AutomationElement]::RootElement.FindFirst([Windows.Automation.TreeScope]::Descendants, $c);`;
const present = (pid, name) => ps(`Add-Type -AssemblyName UIAutomationClient; ${find(pid, name)} if ($b) { 'yes' } else { 'no' }`) === "yes";
const press = (pid, name) => ps(`Add-Type -AssemblyName UIAutomationClient, System.Windows.Forms; ${find(pid, name)} if ($b) { $b.SetFocus(); Start-Sleep -Milliseconds 300; [System.Windows.Forms.SendKeys]::SendWait(' '); 'pressed' } else { 'missing' }`);
async function choose(pid, name) { // the first press may only bring the box to the front: press until the button is gone
  for (let i = 0; i < 4 && present(pid, name); i++) { press(pid, name); await wait(1000); }
  return !present(pid, name);
}
const closeRequest = (pid) => { try { execFileSync("taskkill", ["/pid", String(pid)], { stdio: "ignore" }); } catch { /* gone */ } };
const hardStop = async (child) => { try { execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch { /* gone */ } await wait(1500); };

async function launch(withPlay, debugPort) {
  const child = spawn("D:/Projects/aidea/node_modules/electron/dist/electron.exe", ["D:/Projects/aidea", `--remote-debugging-port=${debugPort}`, `--user-data-dir=${join(root, "ud" + debugPort)}`], { env, stdio: "ignore" });
  let browser;
  for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${debugPort}`); } catch { await wait(500); } }
  let page;
  for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
  await page.waitForFunction(() => typeof openProject === "function" && typeof layoutApi !== "undefined", null, { timeout: 40000 });
  await page.evaluate((x) => openProject(x), project);
  await page.waitForFunction(() => document.getElementById("home").hidden && document.getElementById("opening").hidden, null, { timeout: 120000 });
  await wait(1500);
  if (withPlay) {
    const PLAY = '[data-topbar-plugin="run.play"] button';
    await page.click(PLAY);
    await page.waitForSelector(".dialog-layer button.primary", { timeout: 15000 }); // aidea's own consent dialog
    await page.click(".dialog-layer button.primary");
    await page.waitForFunction((sel) => !document.querySelector(sel).parentElement.querySelector("button:nth-child(2)").hidden, PLAY, { timeout: 30000 });
  }
  return { child, page };
}

check("the port is free before the test starts", !(await answers(port)));

// 1. Nothing running: closing does not ask.
let a = await launch(false, 9421);
closeRequest(a.child.pid);
for (let i = 0; i < 30 && alive(a.child.pid); i++) await wait(500);
check("with nothing running the window closes without asking", !alive(a.child.pid));

// 2. A part running: closing asks; Keep leaves everything; then "Stop and close" ends the part and the app.
a = await launch(true, 9422);
check("db is running", await answers(port));
closeRequest(a.child.pid);
await wait(2500);
check("closing asks (the question is on screen)", present(a.child.pid, "Keep aidea open"));
check("Keep aidea open: the question goes away", await choose(a.child.pid, "Keep aidea open"));
await wait(1000);
check("Keep: the app and the part keep running", alive(a.child.pid) && (await answers(port)));

// 3. Restarting from the plugin manager asks the same question; Keep leaves everything running.
a.page.evaluate(() => window.aidea.restart()); // not awaited: it answers when the person chooses
await wait(2500);
check("restarting asks too", present(a.child.pid, "Keep aidea open"));
check("Keep aidea open: the question goes away", await choose(a.child.pid, "Keep aidea open"));
await wait(1000);
check("Keep: the app and the part keep running after the restart question", alive(a.child.pid) && (await answers(port)));

// 4. "Stop and close" ends the part and the app.
closeRequest(a.child.pid);
await wait(2500);
check("closing asks again", present(a.child.pid, "Stop and close"));
check("Stop and close: the question goes away", await choose(a.child.pid, "Stop and close"));
for (let i = 0; i < 30 && alive(a.child.pid); i++) await wait(500);
await wait(1500);
check("Stop and close: the app exited and no port is busy", !alive(a.child.pid) && !(await answers(port)));

// 5. The core cannot say whether anything runs (killed): closing still asks, in other words, and "Close anyway" closes.
a = await launch(false, 9423);
await a.page.evaluate(() => fetch("/plugins/run/call/stopAll", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }));
const coreProc = ps(`(Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'core.main\\.ts|src.core.main' } | Select-Object -First 1).ProcessId`);
if (coreProc) { try { execFileSync("taskkill", ["/pid", coreProc, "/F"], { stdio: "ignore" }); } catch { /* gone */ } }
await wait(1500);
closeRequest(a.child.pid);
await wait(2500);
check("with the core gone, closing asks that it could not check", present(a.child.pid, "Close anyway"));
check("Close anyway: the question goes away", await choose(a.child.pid, "Close anyway"));
for (let i = 0; i < 30 && alive(a.child.pid); i++) await wait(500);
check("Close anyway: the app exits", !alive(a.child.pid));
await hardStop(a);
console.log(results.every(Boolean) ? "ALL PASS" : "SOME FAILED");
process.exit(0);
