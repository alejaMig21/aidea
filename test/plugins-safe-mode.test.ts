import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, before, test } from "node:test";
import { startCore } from "../src/core/server.ts";

// Ticket plugin-system/10: aidea can start with every third-party plugin off, and an emergency screen of the kernel (no plugin, no feature script) lists plugins and switches them off.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

const scratch = mkdtempSync(join(tmpdir(), "aidea-safe-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));
const log = ((globalThis as any).__plugLog ??= [] as string[]) as string[];

const manifest = (id: string, extra: object = {}) => ({ id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...extra });
let n = 0;
function plugin(root: string, folder: string, m: object, main = "export function activate() {}") {
  const dir = join(root, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify(m));
  writeFileSync(join(dir, "main.js"), main);
}
async function start(safeMode: boolean, withPlugins = true) {
  const store = join(scratch, `store${n++}`), builtin = join(scratch, `builtin${n++}`);
  mkdirSync(store, { recursive: true });
  if (withPlugins) {
    plugin(builtin, "shipped", manifest("fixture.shipped"));
    plugin(store, "third", manifest("fixture.third"), `globalThis.__plugLog.push("third-party ran"); export function activate() {}`);
    plugin(store, "broken", manifest("fixture.broken"), `export function activate() { throw new Error("it is broken"); }`);
  }
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: builtin, safeMode, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, `prefs${n}.json`), learnerDir: join(scratch, "learner") });
  const list = async () => (await (await fetch(core.url + "/plugins")).json()) as any;
  const post = async (path: string, body: unknown) => {
    const res = await fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as any };
  };
  return { core, store, list, post };
}

test("in safe mode no third-party plugin runs: they are listed inactive with the reason, the ones that ship with aidea still run", async () => {
  log.length = 0;
  const t = await start(true);
  try {
    const { plugins, safeMode } = await t.list();
    assert.equal(safeMode, true);
    const by = Object.fromEntries(plugins.map((p: any) => [p.id, p]));
    assert.equal(by["fixture.shipped"].state, "active");
    assert.equal(by["fixture.third"].state, "inactive");
    assert.match(by["fixture.third"].reason, /safe mode/);
    assert.ok(!log.includes("third-party ran"), "the code of a third-party plugin must not run in safe mode");
  } finally { t.core.close(); }
});

test("outside safe mode the same plugins run, and the list says safe mode is off", async () => {
  log.length = 0;
  const t = await start(false);
  try {
    const { plugins, safeMode } = await t.list();
    assert.equal(safeMode, false);
    assert.equal(plugins.find((p: any) => p.id === "fixture.third").state, "active");
    assert.ok(log.includes("third-party ran"));
  } finally { t.core.close(); }
});

test("in safe mode a third-party plugin cannot be switched on or installed", async () => {
  const t = await start(true);
  try {
    const on = await t.post("/plugins/enable", { id: "fixture.third" });
    assert.equal(on.status, 409);
    assert.match(on.body.error, /safe mode/);
  } finally { t.core.close(); }
});

test("the emergency screen is a page of the kernel: small, with no feature script and no dock library", async () => {
  const t = await start(false, false);
  try {
    const res = await fetch(t.core.url + "/emergency");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    const html = await res.text();
    assert.ok(html.length < 20_000, `${html.length} bytes`);
    assert.doesNotMatch(html, /dockview|layoutApi|src="\/vendor|src="\/plugins/);
    assert.match(html, /emergency/i);
    assert.match(html, /id="plugins"/);
  } finally { t.core.close(); }
});

// The emergency screen in a real page: it lists the plugins, including a broken one, and switches that one off.
let page: any;
let core: Awaited<ReturnType<typeof start>>;
function startProxy(coreUrl: string) {
  const target = new URL(coreUrl);
  const drive = `<script>${readFileSync(new URL("./plugins-emergency-page.js", import.meta.url), "utf8")}</script>`;
  return new Promise<Server>((resolve) => {
    const server = createServer((req, res) => {
      const { origin: _origin, ...headers } = req.headers;
      const up = request({ host: target.hostname, port: target.port, method: req.method, path: req.url, headers: { ...headers, host: target.host } }, (answer) => {
        if (req.url !== "/emergency") { res.writeHead(answer.statusCode ?? 502, answer.headers); answer.pipe(res); return; }
        let html = "";
        answer.setEncoding("utf8").on("data", (c) => (html += c)).on("end", () => {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(html.replace("</body>", () => `${drive}</body>`));
        });
      });
      req.pipe(up);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}
before(async () => {
  if (skip) return;
  core = await start(false);
  const proxy = await startProxy(core.core.url);
  try {
    const { stdout } = await promisify(execFile)(chrome!, [
      "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1200,800",
      "--virtual-time-budget=20000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/emergency`,
    ], { timeout: 90_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="em-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(() => core?.core.close());

test("the emergency screen lists every plugin with its state and reason, even a broken one", { skip }, () => {
  assert.deepEqual(page.errors, []);
  assert.ok(page.rows.some((r: any) => r.id === "fixture.broken" && r.state === "failed" && /broken/.test(r.text)));
  assert.ok(page.rows.some((r: any) => r.id === "fixture.shipped" && r.state === "active"));
});

test("it switches a plugin off, and the choice is kept for the next start", { skip }, async () => {
  assert.equal(page.afterOff.state, "inactive");
  const again = await startCore({ port: 0, pluginsDir: core.store, builtinPluginsDir: false });
  try {
    const { plugins } = (await (await fetch(again.url + "/plugins")).json()) as any;
    assert.equal(plugins.find((p: any) => p.id === "fixture.third").state, "inactive");
  } finally { again.close(); }
});
