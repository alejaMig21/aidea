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

// Ticket plugin-system/06 (window): the plugin manager screen lists the installed plugins and the quarantine, shows the scan, and installs after a confirmation that names each blocking finding.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

const manifest = (id: string, extra: object = {}) => ({ id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", ...extra });
let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

const source = (name: string, files: Record<string, string>) => {
  const dir = join(scratch, name);
  mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(files)) writeFileSync(join(dir, file), text);
  return dir;
};

function startProxy(coreUrl: string, project: string, add: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)}; window.PM_ADD = ${JSON.stringify(add)};</script>`;
  const drive = `<script>${readFileSync(new URL("./plugin-manager-page.js", import.meta.url), "utf8")}</script>`;
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

before(async () => {
  if (skip) return;
  scratch = mkdtempSync(join(tmpdir(), "aidea-pm-"));
  const store = join(scratch, "store");
  mkdirSync(store, { recursive: true });
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: store, builtinPluginsDir: false });
  const quarantine = (dir: string) => fetch(core.url + "/plugins/quarantine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: dir }) });
  await quarantine(source("clean", {
    "aidea-plugin.json": JSON.stringify(manifest("fixture.clean", { ui: "ui.js", capabilities: ["secrets"], settings: { mood: { type: "choice", label: "Mood", options: ["calm", "lively"], default: "calm" }, count: { type: "number", label: "Count", default: 2 }, token: { type: "secret", label: "Token" } } })),
    "ui.js": `export function activate(ui) { return ui.slots.add("layout.panel", { id: "p", title: "Installed live", render(c) { c.textContent = "hi"; } }); }`,
  }));
  await quarantine(source("loud", {
    "aidea-plugin.json": JSON.stringify(manifest("fixture.loud", { main: "main.js" })),
    "main.js": `import cp from "node:child_process"; export function activate() { fetch("http://127.0.0.1:1/").catch(() => {}); }`,
  }));
  const added = source("added", { "aidea-plugin.json": JSON.stringify(manifest("fixture.added", { main: "main.js" })), "main.js": "export function activate() {}" });
  const proxy = await startProxy(core.url, fixture("shop"), added);
  try {
    const { stdout } = await promisify(execFile)(chrome!, [
      "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1900,1000",
      "--virtual-time-budget=40000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`,
    ], { timeout: 120_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="pm-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    const text = raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    if (process.env.AIDEA_DEBUG_PAGE) console.log(text);
    page = JSON.parse(text);
  } finally { proxy.close(); }
});

after(() => {
  core?.close();
  if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test("the page loads without errors", { skip }, () => {
  assert.deepEqual(page.errors, []);
});

test("a Plugins button in the top bar, outside the Panels control, opens the manager", { skip }, () => {
  assert.deepEqual([page.button.present, page.button.visible, page.button.outsidePanels, page.button.panelsControlButtons], [true, true, true, 1]);
  assert.equal(page.opened, true);
});

test("the quarantine is listed with each plugin's findings, and the screen says a scan proves nothing", { skip }, () => {
  const byTitle = Object.fromEntries(page.quarantine.map((q: any) => [q.title, q]));
  assert.deepEqual([byTitle["Title of fixture.clean"].blocking, byTitle["Title of fixture.clean"].installDisabled], [0, false]);
  assert.ok(byTitle["Title of fixture.loud"].blocking >= 2);
  assert.equal(byTitle["Title of fixture.loud"].boxes, byTitle["Title of fixture.loud"].blocking, "one confirmation box for each blocking finding");
  assert.equal(byTitle["Title of fixture.loud"].installDisabled, true);
  assert.match(page.note, /lowers the risk/i);
  assert.match(page.note, /does not prove|proves nothing/i);
});

test("installing a clean plugin applies at once: its Panel appears, it is listed as installed and it leaves the quarantine", { skip }, () => {
  assert.deepEqual([page.clean.panelRow, page.clean.inInstalled, page.clean.leftQuarantine], [true, true, true]);
});

test("a plugin with blocking findings cannot be installed until every one is confirmed by name", { skip }, () => {
  assert.equal(page.loudBefore.disabled, true);
  assert.equal(page.loudPartial.disabled, true, "one confirmation of several is not enough");
  assert.equal(page.loudAll.disabled, false);
  assert.deepEqual([page.loudInstalled.state, page.loudInstalled.leftQuarantine], ["active", true]);
});

test("a folder added from the screen lands in the quarantine, and an address that is not valid is refused with a message", { skip }, () => {
  assert.equal(page.added, true);
  assert.notEqual(page.refused, "");
});

test("the settings form is drawn from the schema, saves valid values, names a bad field and saves nothing then", { skip }, () => {
  assert.deepEqual(page.settings.fields, ["mood:SELECT", "count:INPUT", "token:INPUT"]);
  assert.deepEqual([page.settings.mood, page.settings.count, page.settings.tokenType, page.settings.tokenPlaceholder], ["calm", "2", "password", "not set"]);
  assert.match(page.settings.savedMessage, /are saved/);
  assert.deepEqual([page.settings.afterSave.mood, page.settings.afterSave.count, page.settings.afterSave.tokenPlaceholder], ["lively", 7, "set (leave empty to keep it)"]);
  assert.equal(page.settings.afterSave.secretInPage, false, "the secret is not in the page after saving");
  assert.match(page.settings.badError, /one of: calm, lively/);
  assert.match(page.settings.badMessage, /Nothing was saved/);
  assert.equal(page.settings.afterBad, "lively", "the bad save changed nothing");
});

test("switching a plugin off from its row takes its Panel away at once, and switching it on brings it back", { skip }, () => {
  assert.deepEqual([page.off.state, page.off.panelGone], ["inactive", true]);
  assert.deepEqual([page.on.state, page.on.panelBack], ["active", true]);
});

test("removing a plugin that already ran says a restart is needed and offers the button; its Panel is gone", { skip }, () => {
  assert.deepEqual([page.removed.gone, page.removed.panelGone, page.removed.restartButton], [true, true, true]);
  assert.match(page.removed.message, /restart/i);
});

test("a plugin the Builder proposes opens the manager with a message that names it", { skip }, () => {
  assert.equal(page.proposed.visible, true);
  assert.match(page.proposed.message, /Builder proposed the plugin "Made by the Builder"/);
});

test("Escape closes the manager and the button opens it again", { skip }, () => {
  assert.deepEqual([page.closed, page.reopened], [true, true]);
});
