import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, request } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, before, test } from "node:test";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// Ticket 19: the Layout is saved, restored after a restart, and never leaves an empty window. Three loads of the real page in headless Chrome:
// "arrange" (the person arranges it), "reopen" (a new page that starts with what was saved, then is fed bad data) and "legacy" (a save of the fixed grid).
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

const LEGACY = JSON.stringify({ chatFolded: false, filesFolded: true, codeFolded: true, runFolded: false, rightFolded: true, canvasFolded: false, sized: { chat: true }, chat: 300 });
let arrangeReport: any, reopenReport: any, legacyReport: any;
let core: Awaited<ReturnType<typeof startCore>>;
let scratch = "";

function startProxy(coreUrl: string, project: string, mode: string, stored: string | null, withRun: string | null) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)}; window.SAVE_MODE = ${JSON.stringify(mode)}; window.SAVE_STORED = ${JSON.stringify(stored)}; window.SAVE_WITH_RUN = ${JSON.stringify(withRun)}; ${stored ? `localStorage.setItem("aidea.layout", window.SAVE_STORED);` : ""}</script>`;
  const drive = `<script>${readFileSync(new URL("./layout-save-page.js", import.meta.url), "utf8")}</script>`;
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

async function load(mode: string, stored: string | null = null, withRun: string | null = null) {
  const proxy = await startProxy(core.url, fixture("shop"), mode, stored, withRun);
  try {
    const { stdout } = await promisify(execFile)(chrome!, [
      "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile-" + mode)}`, "--window-size=1900,1000",
      "--virtual-time-budget=30000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`,
    ], { timeout: 90_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="save-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, `the page never wrote its report (${mode})`);
    const text = raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    if (process.env.AIDEA_DEBUG_PAGE) console.log(text);
    return JSON.parse(text);
  } finally { proxy.close(); }
}

before(async () => {
  if (skip) return;
  scratch = mkdtempSync(join(tmpdir(), "aidea-save-"));
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner") });
  arrangeReport = await load("arrange");
  reopenReport = await load("reopen", arrangeReport.arranged.stored, arrangeReport.arranged.withRun);
  legacyReport = await load("legacy", LEGACY);
});

after(() => {
  core?.close();
  if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test("the pages load without errors", { skip }, () => {
  assert.deepEqual([arrangeReport.errors, reopenReport.errors, legacyReport.errors], [[], [], []]);
});

test("the arrangement is saved as plain data, the same on two reads", { skip }, () => {
  const a = arrangeReport.arranged;
  assert.equal(a.twice, true);
  assert.deepEqual(a.groups, ["canvas", "chat+files", "code", "right"]);
  const saved = JSON.parse(a.stored);
  assert.ok(saved.dock && typeof saved.dock === "object", "the saved Layout holds the arrangement");
  assert.equal(saved.codeFolded, false);
});

test("reopening brings back the groups, the tabs and the sizes the person left", { skip }, () => {
  assert.deepEqual(reopenReport.opened.groups, arrangeReport.arranged.groups);
  assert.deepEqual(reopenReport.opened.inDock, arrangeReport.arranged.inDock);
  for (const [id, w] of Object.entries(arrangeReport.arranged.widths) as [string, number][]) assert.ok(Math.abs(reopenReport.opened.widths[id] - w) <= 3, `${id}: ${reopenReport.opened.widths[id]} vs ${w}`);
});

test("a Layout saved with Run in it, restored without a Flow, keeps the relations between the sizes of the other Panels", { skip }, () => {
  const { inDock, widths, saved } = reopenReport.withRun;
  assert.equal(inDock.includes("run"), false);
  for (const [a, b] of [["chat", "canvas"], ["canvas", "right"]]) assert.ok(Math.abs(widths[a] / widths[b] - saved[a] / saved[b]) < 0.05, `${a}/${b}: ${widths[a] / widths[b]} vs ${saved[a] / saved[b]}`);
});

test("a Panel that needs something (Run) is left out of a restored Layout until it is available", { skip }, () => {
  assert.equal(reopenReport.run.atStart, false);
  assert.equal(reopenReport.run.whenAvailable, true);
});

test("a saved Layout with an unknown Panel id loads without it", { skip }, () => {
  const c = reopenReport.cases.unknownId;
  assert.equal(c.inDock.includes("ghost"), false);
  assert.deepEqual(c.groups, arrangeReport.arranged.groups, "the rest of the arrangement is kept");
});

test("a Layout that is not valid data, or cannot be restored, gives the default Layout and never an empty window", { skip }, () => {
  for (const name of ["notData", "empty", "nullDock", "wrongShape", "unrestorable"]) {
    const c = reopenReport.cases[name];
    assert.equal(c.canvasShown, true, `${name}: the Canvas is on screen`);
    assert.ok(c.inDock.includes("canvas") && c.inDock.includes("chat") && c.inDock.includes("right"), `${name}: ${c.inDock}`);
  }
});

test("a save of the fixed grid (folded flags and a size) still gives the arrangement it described", { skip }, () => {
  assert.deepEqual(legacyReport.legacy.inDock, ["canvas", "chat"]);
  assert.ok(Math.abs(legacyReport.legacy.chatWidth - 300) <= 3, `Builder is ${legacyReport.legacy.chatWidth}`);
});
