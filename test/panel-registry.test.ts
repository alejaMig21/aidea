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

type Entry = { title: string; id: string; checked: string; disabled: boolean; reason: string; markVisible: boolean; focusable: boolean };
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

// What is expected comes from the page's own registry (a Panel declared there appears here by itself): left Panels, the Canvas, then right Panels.
const order = () => {
  const reg = report.registry as { id: string; title: string; side: string; conditional: boolean }[];
  const left = reg.filter((d) => d.side === "left"), right = reg.filter((d) => d.side !== "left");
  return { left, right, titles: [...left.map((d) => d.title), "Canvas", ...right.map((d) => d.title)], cards: [...left.map((d) => d.id), "main", ...right.map((d) => d.id)] };
};

test("the page loads without errors and its Panels stand in the order of the registry", { skip }, () => {
  assert.deepEqual(report.errors, []);
  assert.ok(report.registry.length >= 5);
  // Left to right on the screen (the page lists the cards by position): the registry order of every Panel that should be shown (the saved layout hides some).
  const wanted = new Set<string>(report.wanted);
  assert.ok(wanted.size >= 1);
  assert.deepEqual(report.cards, order().cards.filter((id) => id === "main" || wanted.has(id)));
});

test("the Canvas keeps its own look inside the docking Layout: its dark surface and its dot grid", { skip }, () => {
  assert.match(report.canvasLook.image, /radial-gradient/, "the dot grid was lost when the Layout restyled the Canvas");
  assert.equal(report.canvasLook.color, "rgb(17, 20, 26)");
});

test("the header has one control for Panels and no per-Panel button", { skip }, () => {
  assert.equal(report.headerControls, 1);
  assert.equal(report.perPanelButtons, 0);
  assert.equal(report.menuClosedAtStart, true);
});

test("the Panels menu lists every Panel with a check mark; a Panel that cannot be used is listed with its reason", { skip }, () => {
  const entries = report.entries as Entry[];
  assert.deepEqual(entries.map((e) => e.title), order().titles);
  const conditional = new Set(order().left.concat(order().right).filter((d) => d.conditional).map((d) => d.title));
  assert.ok(conditional.size >= 1);
  for (const e of entries) {
    assert.equal(e.disabled, conditional.has(e.title), `${e.title} is unusable only when it depends on something`);
    assert.equal(e.reason !== "", e.disabled, `${e.title}: a reason is shown exactly when it cannot be used`);
  }
  assert.match(entries.find((e) => e.title === "Run")!.reason, /Flow/);
  // The check mark is drawn only for a Panel that is on screen (it was once drawn on every row).
  assert.ok(entries.every((e) => e.markVisible === (e.checked === "true")), "a check mark appears exactly on the checked rows");
});

test("a layout saved by an earlier version still loads, and an id no Panel has is ignored and never written back", { skip }, () => {
  assert.deepEqual(report.saved, { chatShown: false, filesShown: true, ghostIgnored: true });
  const ids = (report.registry as { id: string }[]).map((d) => d.id);
  assert.deepEqual(report.stored, ["canvasFolded", "sized", ...ids.map((id) => `${id}Folded`), "chat"].sort(), "the old key names, the one size the person set, and nothing about an unknown id");
  assert.deepEqual(report.storedSizes, { sized: { chat: true }, chat: 300 }, "the sizes an old save held are written back untouched");
});

test("the menu works by keyboard and mouse: it opens on the first row, moves, toggles, and closes by Escape (focus back), Tab and a click outside", { skip }, () => {
  assert.deepEqual(report.menuOpen, { hidden: false, expanded: "true", focusIsItem: true, moved: true });
  assert.deepEqual(report.toggle, { was: true, now: false, stillOpen: true, checked: "false" });
  assert.deepEqual(report.escape, { hidden: true, focusOnButton: true });
  assert.deepEqual(report.closes, { byTab: true, byOutsideClick: true });
});

test("a row that cannot be used stays reachable by keyboard so its reason can be read, and does nothing when activated", { skip }, () => {
  assert.equal(report.unusable.focused, true);
  assert.notEqual(report.unusable.reason, "");
  assert.equal(report.unusable.shownAfter, report.unusable.shownBefore);
  assert.ok((report.entries as Entry[]).every((e) => e.focusable), "rows are focusable by script and out of the Tab order");
});

test("a Panel that depends on something is enabled and shown once it is available", { skip }, () => {
  assert.deepEqual(report.conditional, { id: report.conditional.id, enabled: true, shown: true });
});

test("hiding the Canvas from the menu leaves the Panels on screen, one group each, and showing it brings it back", { skip }, () => {
  assert.equal(report.canvasHidden.canvasShown, false);
  assert.equal(report.canvasHidden.groups, report.canvasHidden.panelsShown);
  assert.equal(report.canvasBack.canvasShown, true);
});

test("a new Panel is one declaration: a menu entry, a card, a body and a place in the Layout appear and the header does not grow", { skip }, () => {
  const s = report.seventh;
  assert.equal(s.entriesAfter, s.entriesBefore + 1);
  assert.deepEqual([s.hasCard, s.hasPane, s.inLayoutAfterMenu], [true, true, true]);
  assert.equal(s.headerAfter, s.headerBefore);
  assert.equal(s.headerAfter, 1);
  assert.equal(s.hiddenAtStart, true);
  assert.equal(s.inLayoutAtStart, false, "a Panel that starts hidden is not in the Layout until it is shown");
  assert.equal(s.shownAfterMenu, true);
  assert.deepEqual(report.finalCards.at(-1), "notes", "a Panel declared last stands at the right end");
});
