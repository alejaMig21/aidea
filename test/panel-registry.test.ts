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

// The page the person sees, loaded in headless Chrome with a script that drives it (as legend-check.test.ts does). The Panels are declared once
// in a registry; this test proves it on the real page: one header control, one menu, and a seventh Panel added with a single declaration.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

type Entry = { title: string; checked: string; disabled: boolean; reason: string };
let report: any;
let core: Awaited<ReturnType<typeof startCore>>;
let proxy: Server;
let scratch = "";

// A layout saved by an earlier version, with an id that no Panel has any more: it must still load and the unknown id must be ignored.
const OLD_LAYOUT = JSON.stringify({ chatFolded: true, filesFolded: false, codeFolded: true, runFolded: false, rightFolded: false, canvasFolded: false, sized: { chat: true }, chat: 300, ghostFolded: true, ghost: 123 });

function startProxy(coreUrl: string, project: string) {
  const target = new URL(coreUrl);
  const seed = `<script>localStorage.setItem("aidea.layout", ${JSON.stringify(OLD_LAYOUT)}); window.PANELS_PROJECT = ${JSON.stringify(project)};</script>`;
  const drive = `<script>${readFileSync(new URL("./panel-registry-page.js", import.meta.url), "utf8")}</script>`;
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
  scratch = mkdtempSync(join(tmpdir(), "aidea-panels-"));
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner") });
  proxy = await startProxy(core.url, fixture("shop"));
  const { stdout } = await promisify(execFile)(chrome!, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1900,1000",
    "--virtual-time-budget=20000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`,
  ], { timeout: 60_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  const raw = /<pre id="panel-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
  assert.ok(raw, "the page never wrote its report");
  const text = raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  if (process.env.AIDEA_DEBUG_PAGE) console.log(text);
  try { report = JSON.parse(text); } catch (e) { throw new Error(`the page's report is not JSON: ${text.slice(0, 400)} | around the marker: ${stdout.slice(Math.max(0, stdout.indexOf("panel-report") - 120), stdout.indexOf("panel-report") + 300)}`); }
});

after(() => {
  proxy?.close();
  core?.close();
  if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test("the page loads without errors and its Panels stand in order from the registry", { skip }, () => {
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.cards, ["chat", "files", "code", "main", "run", "right"]);
});

test("the header has one control for Panels and no per-Panel button", { skip }, () => {
  assert.equal(report.headerControls, 1);
  assert.equal(report.perPanelButtons, 0);
  assert.equal(report.menuClosedAtStart, true);
});

test("the Panels menu lists every Panel with a check mark; Run is listed, disabled, with the reason", { skip }, () => {
  const titles = (report.entries as Entry[]).map((e) => e.title);
  assert.deepEqual(titles, ["Builder", "Files", "Code", "Canvas", "Run", "Tutor"]);
  const run = (report.entries as Entry[]).find((e) => e.title === "Run")!;
  assert.equal(run.disabled, true);
  assert.match(run.reason, /Flow/);
  assert.ok((report.entries as Entry[]).filter((e) => e.title !== "Run").every((e) => !e.disabled));
});

test("a layout saved by an earlier version still loads, and an id no Panel has is ignored", { skip }, () => {
  assert.deepEqual(report.saved, { chatShown: false, filesShown: true, chatWeight: 300, ghostIgnored: true });
  assert.deepEqual(report.stored, ["canvasFolded", "chat", "chatFolded", "codeFolded", "filesFolded", "rightFolded", "runFolded", "sized"].sort().filter((k) => report.stored.includes(k)), "the saved layout keeps the old key names");
  for (const k of ["chatFolded", "filesFolded", "codeFolded", "runFolded", "rightFolded", "canvasFolded"]) assert.ok(report.stored.includes(k), k);
});

test("the menu works by keyboard: it opens on the first item, moves, toggles with Space and Escape gives the focus back", { skip }, () => {
  assert.deepEqual(report.menuOpen, { hidden: false, expanded: "true", focusIsItem: true, moved: true });
  assert.deepEqual(report.toggle, { was: true, now: false, stillOpen: true, checked: "false" });
  assert.deepEqual(report.escape, { hidden: true, focusOnButton: true });
});

test("a seventh Panel is one declaration: a menu entry, a card, a separator and a body appear and the header does not grow", { skip }, () => {
  const s = report.seventh;
  assert.equal(s.entriesAfter, s.entriesBefore + 1);
  assert.deepEqual([s.hasCard, s.hasPane, s.hasSeparator], [true, true, true]);
  assert.equal(s.headerAfter, s.headerBefore);
  assert.equal(s.headerAfter, 1);
  assert.equal(s.hiddenAtStart, true);
  assert.equal(s.shownAfterMenu, true);
  assert.deepEqual(report.finalCards, ["chat", "files", "code", "main", "run", "right", "notes"]);
});
