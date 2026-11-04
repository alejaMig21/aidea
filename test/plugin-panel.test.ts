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
import { fixture } from "./helpers.ts";

// Ticket plugin-system/03: the interface half of a plugin adds a Panel to the Layout through the named slot `layout.panel`. Two loads of the real page in headless Chrome.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

const base = (id: string, extra: object = {}) => ({ id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", ui: "ui.js", ...extra });
const PANEL_UI = `export function activate(ui) {
  return ui.slots.add("layout.panel", { id: "hello", title: "Hello plugin", render(container) { container.textContent = "Hello from a plugin"; return () => { globalThis.__plugDisposed = true; }; } });
}`;
const BAD_UI = `export function activate(ui) {
  ui.slots.add("layout.panel", { id: "never", title: "Never shown", render(container) { container.textContent = "x"; } });
  ui.slots.add("nope.slot", { id: "x" });
}`;
let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let live: any, reopen: any;

function startProxy(coreUrl: string, project: string, mode: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)}; window.PLUG_MODE = ${JSON.stringify(mode)};</script>`;
  const drive = `<script>${readFileSync(new URL("./plugin-panel-page.js", import.meta.url), "utf8")}</script>`;
  return new Promise<Server>((resolve) => {
    const server = createServer((req, res) => {
      const { origin: _origin, ...headers } = req.headers;
      const up = request({ host: target.hostname, port: target.port, method: req.method, path: req.url, headers: { ...headers, host: target.host } }, (answer) => {
        if (req.url !== "/") { res.writeHead(answer.statusCode ?? 502, answer.headers); answer.pipe(res); return; }
        let html = "";
        answer.setEncoding("utf8").on("data", (c) => (html += c)).on("end", () => {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(html.replace("<head>", () => `<head>${seed}`).replace("</body>", () => `${drive}</body>`));
        });
      });
      req.pipe(up);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

async function load(mode: string) {
  const proxy = await startProxy(core.url, fixture("shop"), mode);
  try {
    const { stdout } = await promisify(execFile)(chrome!, [
      "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile-" + mode)}`, "--window-size=1900,1000",
      "--virtual-time-budget=30000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`,
    ], { timeout: 90_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="plug-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, `the page never wrote its report (${mode})`);
    const text = raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    if (process.env.AIDEA_DEBUG_PAGE) console.log(text);
    return JSON.parse(text);
  } finally { proxy.close(); }
}

before(async () => {
  if (skip) return;
  scratch = mkdtempSync(join(tmpdir(), "aidea-plugpanel-"));
  const store = join(scratch, "store");
  for (const [folder, manifest, ui] of [["panel", base("fixture.panel"), PANEL_UI], ["bad", base("fixture.badslot"), BAD_UI]] as const) {
    mkdirSync(join(store, folder), { recursive: true });
    writeFileSync(join(store, folder, "aidea-plugin.json"), JSON.stringify(manifest));
    writeFileSync(join(store, folder, "ui.js"), ui);
  }
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: store });
  live = await load("live");
  reopen = await load("reopen");
});

after(() => {
  core?.close();
  if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test("the pages load without errors", { skip }, () => {
  assert.deepEqual([live.errors, reopen.errors], [[], []]);
});

test("the interface half of an active plugin adds a Panel: a menu row, a Panel in the Layout and its content", { skip }, () => {
  assert.deepEqual([live.added.inDock, live.added.row, live.added.text, live.added.checked], [true, true, "Hello from a plugin", "true"]);
});

test("a plugin that adds to a slot that does not exist is failed with a reason, and nothing of it stays on screen", { skip }, () => {
  assert.equal(live.badSlot.state, "failed");
  assert.match(live.badSlot.reason, /nope\.slot/);
  assert.deepEqual([live.badSlot.panelOnScreen, live.badSlot.row], [false, false]);
});

test("disabling the plugin takes its Panel and its menu row away at once and runs its undo; the other Panels stay", { skip }, () => {
  assert.deepEqual([live.disabled.inDock, live.disabled.row, live.disabled.disposed], [false, false, true]);
  assert.deepEqual([live.disabled.canvas, live.disabled.chat], [true, true]);
  assert.ok(live.disabled.groups >= 2, "the window is not left empty");
});

test("enabling it again brings the Panel back", { skip }, () => {
  assert.deepEqual([live.enabled.inDock, live.enabled.row], [true, true]);
});

test("a restart puts the Panel of a plugin where the person left it", { skip }, () => {
  assert.deepEqual([reopen.opened.inDock, reopen.opened.withChat], [true, true]);
});
