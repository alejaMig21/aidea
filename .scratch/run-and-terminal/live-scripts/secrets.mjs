// Live check: a plugin's secret survives closing and reopening the real Electron window, and is encrypted on disk.
import { chromium } from "playwright-core";
import { spawn, execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const root = join(import.meta.dirname, "data-secrets");
rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
const store = join(root, "store"), project = join(root, "project"), plug = join(store, "fixture-sec");
mkdirSync(plug, { recursive: true });
cpSync("D:/Projects/aidea/test/fixtures/shop", project, { recursive: true });
writeFileSync(join(plug, "aidea-plugin.json"), JSON.stringify({ id: "fixture.sec", version: "1.0.0", title: "Secret keeper", description: "Holds one secret.", publisher: "tests", api: "0.1", main: "main.js", capabilities: ["secrets"], settings: { token: { type: "secret", label: "Token" } } }));
writeFileSync(join(plug, "main.js"), "export function activate() {}");
const keyFile = join(root, "secret.key"), secretsFile = join(root, "secrets.enc");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(ok ? "PASS" : "FAIL", name, detail); };
const env = { ...process.env, AIDEA_RECENTS_FILE: join(root, "recents.json"), AIDEA_PREFERENCES_FILE: join(root, "prefs.json"), AIDEA_LEARNER_DIR: join(root, "learner"), AIDEA_PLUGINS_DIR: store, AIDEA_SECRET_KEY_FILE: keyFile, AIDEA_SECRETS_FILE: secretsFile };
const SECRET = "live-secret-value-4711";
async function launch(port) {
  const child = spawn("D:/Projects/aidea/node_modules/electron/dist/electron.exe", ["D:/Projects/aidea", `--remote-debugging-port=${port}`, `--user-data-dir=${join(root, "ud")}`], { env, stdio: "ignore" });
  let browser;
  for (let i = 0; i < 80 && !browser; i++) { try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch { await wait(500); } }
  let page;
  for (let i = 0; i < 80 && !page; i++) { page = browser.contexts()[0]?.pages()[0]; if (!page) await wait(500); }
  await page.waitForFunction(() => typeof openProject === "function", null, { timeout: 40000 });
  return { child, page };
}
const settings = (page) => page.evaluate(async () => (await (await fetch("/plugins/fixture.sec/settings")).json()).values.token);
const stop = async (child, hard = false) => { try { execFileSync("taskkill", ["/pid", String(child.pid), ...(hard ? ["/T", "/F"] : [])], { stdio: "ignore" }); } catch { /* gone */ } for (let i = 0; i < 40 && !child.killed && child.exitCode === null; i++) await wait(250); if (child.exitCode === null) { try { execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" }); } catch {} } await wait(1500); };

let one = await launch(9401);
check("first run: no secret yet", JSON.stringify(await settings(one.page)) === JSON.stringify({ set: false }), JSON.stringify(await settings(one.page)));
const saved = await one.page.evaluate(async (v) => (await fetch("/plugins/fixture.sec/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: { token: v } }) })).status, SECRET);
check("the secret is saved", saved === 200, String(saved));
check("it reads back as set (never as the value)", JSON.stringify(await settings(one.page)) === JSON.stringify({ set: true }));
await stop(one.child); // closes the window the way the person does
check("the key file exists and is not the key in the clear", existsSync(keyFile) && !/^[0-9a-f]{64}$/i.test(readFileSync(keyFile).toString("utf8").trim()), existsSync(keyFile) ? String(readFileSync(keyFile).length) + " bytes" : "missing");
check("the secrets file exists and holds no readable secret or name", existsSync(secretsFile) && !readFileSync(secretsFile, "utf8").includes(SECRET) && !readFileSync(secretsFile, "utf8").includes("fixture.sec"));

let two = await launch(9402);
const again = await settings(two.page);
check("after closing and reopening aidea the secret is still set", JSON.stringify(again) === JSON.stringify({ set: true }), JSON.stringify(again));
await stop(two.child);
// A forced kill loses the system key on Windows: aidea must still start, keep working and keep new secrets across the next normal restart.
let three = await launch(9403);
await stop(three.child, true);
let four = await launch(9404);
const after = await four.page.evaluate(async (v) => (await fetch("/plugins/fixture.sec/settings", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ values: { token: v } }) })).status, SECRET);
check("after a forced kill aidea still starts and saves a secret", after === 200, String(after));
await stop(four.child);
let five = await launch(9405);
check("and that secret survives the next normal restart", JSON.stringify(await settings(five.page)) === JSON.stringify({ set: true }), JSON.stringify(await settings(five.page)));
await stop(five.child);
console.log(results.every(Boolean) ? "ALL PASS" : "SOME FAILED");
process.exit(0);
