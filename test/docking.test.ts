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

// The docking Layout on the real page, in headless Chrome (as panel-registry.test.ts does): the default arrangement, minimum sizes, showing and hiding,
// tabs, the Canvas that cannot go, and the drawers of a narrow window. Two loads of the page: a wide window and a narrow one.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let wideReport: any, narrowReport: any;
let core: Awaited<ReturnType<typeof startCore>>;
let proxy: Server;
let scratch = "";

function startProxy(coreUrl: string, project: string, mode: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)}; window.DOCK_MODE = ${JSON.stringify(mode)};</script>`;
  const drive = `<script>${readFileSync(new URL("./docking-page.js", import.meta.url), "utf8")}</script>`;
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

async function load(mode: string, size: string) {
  proxy = await startProxy(core.url, fixture("shop"), mode);
  const { stdout } = await promisify(execFile)(chrome!, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile-" + mode)}`, `--window-size=${size}`,
    "--virtual-time-budget=30000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`,
  ], { timeout: 90_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
  proxy.close();
  const raw = /<pre id="dock-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
  assert.ok(raw, `the page never wrote its report (${mode})`);
  const text = raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
  if (process.env.AIDEA_DEBUG_PAGE) console.log(text);
  return JSON.parse(text);
}

before(async () => {
  if (skip) return;
  scratch = mkdtempSync(join(tmpdir(), "aidea-dock-"));
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner") });
  wideReport = await load("wide", "1900,1000");
  narrowReport = await load("narrow", "700,900");
});

after(() => {
  proxy?.close();
  core?.close();
  if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test("the page loads without errors in a wide and in a narrow window", { skip }, () => {
  assert.deepEqual(wideReport.errors, []);
  assert.deepEqual(narrowReport.errors, []);
});

test("the default Layout is today's window: Builder, Canvas, Tutor in one row, with Files, Code and Run not in it, and no close button on a tab", { skip }, () => {
  const d = wideReport.default;
  assert.deepEqual(d.row, ["chat", "canvas", "right"]);
  assert.deepEqual(d.inDock, ["canvas", "chat", "right"]);
  // widths follow the weights 380 : 800 : 540 (a few pixels of the old grid's numbers: 413, 886 and 590 at 1920)
  const total = d.widths.chat + d.widths.canvas + d.widths.right;
  for (const [id, weight] of [["chat", 380], ["canvas", 800], ["right", 540]] as const) assert.ok(Math.abs(d.widths[id] / total - weight / 1720) < 0.012, `${id} is ${d.widths[id]} of ${total}`);
  assert.equal(wideReport.closeButtons, 0, "hiding is done from the Panels menu");
  assert.equal(wideReport.cardsHaveNoTitleRow, 0, "the tab is the title");
});

test("Files then Code, shown from the menu, stand at the left of the Canvas in that order", { skip }, () => {
  assert.deepEqual(wideReport.filesCode.row, ["chat", "files", "code", "canvas", "right"]);
  assert.equal(wideReport.filesCode.ordered, true);
});

test("no Panel can be squeezed below its minimum, by the library's size or by pushing a border with the mouse; the Canvas keeps its own", { skip }, () => {
  assert.deepEqual(wideReport.minimums.tooSmall, []);
  assert.ok(wideReport.minimums.canvas >= 360);
  assert.equal(wideReport.pushed.moved, true, "the border moved");
  assert.equal(wideReport.pushed.touched, true, "the page noticed the border being dragged");
  assert.deepEqual(wideReport.pushed.tooSmall, []);
});

test("Run is in the Layout only while a Flow is open, between the Canvas and the Tutor, and a hide the person chose stays", { skip }, () => {
  const r = wideReport.run;
  assert.equal(r.before, false);
  assert.equal(r.available, true);
  assert.deepEqual(r.order.slice(-3), ["canvas", "run", "right"]);
  assert.equal(r.unavailable, false);
  assert.equal(r.hiddenByPerson, true);
  assert.equal(r.staysHidden, true, "becoming available again does not undo the person's choice");
  assert.equal(r.shownAgain, true);
});

test("a Panel hidden from the menu comes back where it was, wherever it was moved", { skip }, () => {
  const h = wideReport.home;
  assert.equal(h.placed.indexOf("right") < h.placed.indexOf("canvas"), true, "the Tutor was moved to the left of the Canvas");
  assert.equal(h.hidden, true);
  assert.equal(h.sameAsBefore, true);
});

test("two Panels can be grouped as tabs, and a Panel hidden from a group of tabs returns as a tab of it", { skip }, () => {
  const t = wideReport.tabs;
  assert.deepEqual(t.tabs, ["canvas", "chat"]);
  assert.equal(t.gone, true);
  assert.deepEqual(t.back, ["canvas", "chat"]);
  assert.ok(t.tabElements >= 2);
});

test("the Canvas cannot be hidden: with every other Panel hidden its row stays checked and disabled, with a reason", { skip }, () => {
  const a = wideReport.alone;
  assert.deepEqual(a.inDock, ["canvas"]);
  assert.equal(a.checked, "true");
  assert.equal(a.disabled, "true");
  assert.match(a.reason, /Canvas stays/);
  assert.deepEqual(a.afterClick, ["canvas"]);
  assert.ok(wideReport.restored.length >= 3, "showing the Panels again brings them back");
});

test("the docking library is served to the page and nothing else is", { skip }, () => {
  assert.deepEqual(wideReport.vendor, { found: 200, missing: 404 });
});

test("in a narrow window only the Canvas is in the Layout and a Panel opens as a drawer: Close, Escape and the scrim close it, and the focus goes back", { skip }, () => {
  assert.equal(narrowReport.narrow.is, true);
  assert.deepEqual(narrowReport.narrow.inDock, ["canvas"]);
  const d = narrowReport.drawer;
  assert.deepEqual([d.open, d.isDrawer, d.role, d.onScreen, d.covers, d.scrim, d.menuClosed, d.focusInDrawer], ["right", true, "dialog", true, true, true, true, true]);
  assert.deepEqual(d.inDock, ["canvas"], "the drawer is not a docked Panel");
  assert.deepEqual([narrowReport.escape.open, narrowReport.escape.focusOnOpener, narrowReport.escape.onScreen, narrowReport.escape.parked], [null, true, false, "dock-parking"]);
  assert.equal(narrowReport.closeButton.open, null);
  assert.equal(narrowReport.scrim.open, null);
  assert.equal(narrowReport.canvasRow.disabled, "true");
});
