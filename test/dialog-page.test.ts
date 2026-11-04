import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, before, test } from "node:test";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// Ticket 14, the dialog: Play asks for the person's consent in a dialog of aidea's own (ui.confirm), never the browser's window.confirm.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function startProxy(coreUrl: string, project: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)};</script>`;
  const drive = `<script>${readFileSync(new URL("./dialog-page.js", import.meta.url), "utf8")}</script>`;
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
  scratch = mkdtempSync(join(tmpdir(), "aidea-dialog-"));
  const project = join(scratch, "project");
  cpSync(fixture("shop"), project, { recursive: true });
  writeFileSync(join(project, "db.js"), 'console.log("db up"); setInterval(() => {}, 1000);');
  writeFileSync(join(project, "api.js"), 'console.log("api up"); setInterval(() => {}, 1000);');
  mkdirSync(join(project, ".aidea"), { recursive: true });
  writeFileSync(join(project, ".aidea", "run.json"), JSON.stringify({ parts: [{ name: "db", command: "node db.js" }, { name: "api", command: "node api.js", waitFor: ["db"] }] }));
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store") });
  const proxy = await startProxy(core.url, project);
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1900,1000", "--virtual-time-budget=40000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 90_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="dg-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(async () => { await core?.plugins.deactivate("run"); core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); });

test("the page loads without errors and the browser's own confirm dialog is never used", { skip }, () => {
  assert.deepEqual(page.errors, []);
  assert.equal(page.nativeConfirms, 0);
});
test("Play asks in a dialog of aidea's own: modal, titled, every command in monospace, Cancel focused, above the plugin manager", { skip }, () => {
  assert.equal(page.dialog.modal, "true");
  assert.equal(page.dialog.labelled, true);
  assert.match(page.dialog.title, /run these commands/i);
  // the whole recipe, not only the commands: where each part runs, what it waits for, its ready signal, its variables and its limit
  assert.deepEqual(page.dialog.commands, ["db: node db.js", "  no ready signal · limit 60 s", "api: node api.js", "  after db · no ready signal · limit 60 s"]);
  assert.deepEqual(page.dialog.buttons, ["Cancel", "Accept and start"]);
  assert.equal(page.dialog.focused, "Cancel");
  assert.equal(page.dialog.zAbovePluginManager, true);
  assert.equal(page.dialog.font, true);
  assert.equal(page.tabWraps, true);
});
test("Escape and Cancel both mean no: nothing starts and Play says the recipe was not accepted", { skip }, () => {
  assert.equal(page.escape.closed, true);
  assert.match(page.escape.status, /not accepted/i);
  assert.equal(page.cancel.closed, true);
  assert.match(page.cancel.status, /not accepted/i);
  assert.equal(page.afterCancelNothingRuns, true);
});
test("Accept and start accepts the recipe and Play starts it", { skip }, () => assert.deepEqual(page.accept, { closed: true, running: true }));

test("Play leaves a hidden Terminal hidden; showing it gives one tab for each part, and a tab shows the output of its part", { skip }, () => {
  assert.equal(page.terminalHiddenAfterPlay, true);
  assert.deepEqual(page.tabs.labels, ["db (running)", "api (running)"]);
  assert.deepEqual(page.tabs.selected, ["db"]);
  assert.deepEqual(page.tabSwitched, ["api"]);
  assert.equal(page.shownText, true);
});
