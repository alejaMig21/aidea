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

// Layout and keyboard (layout-and-data 11): F6 between Panels, Tab in screen order, the borders between Panels focusable and moved with the arrow keys, a Panel moved by keyboard,
// the layer tabs reachable at 1100 without a sideways scroll. The window is 1100 wide so that three groups are on screen.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function startProxy(coreUrl: string, project: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)};</script>`;
  const drive = `<script>${readFileSync(new URL("./layout-keys-page.js", import.meta.url), "utf8")}</script>`;
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
  scratch = mkdtempSync(join(tmpdir(), "aidea-layout-keys-"));
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store") });
  const proxy = await startProxy(core.url, fixture("shop"));
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1100,900", "--virtual-time-budget=90000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 150_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="lk-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(async () => { await core?.plugins.deactivate("run"); core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); });

test("the page loads without errors with three groups on screen", { skip }, () => {
  assert.deepEqual(page.errors, []);
  assert.deepEqual(page.start, ["chat", "canvas", "right"]);
});
test("the layer tabs stay reachable at 1100 without a sideways scroll", { skip }, () => {
  assert.equal(page.layers.scrolls, false, `the bar is ${page.layers.width}px wide`);
  assert.deepEqual(page.layers.outside, []);
});
test("the keys are written in the Panels menu, which the keyboard walks through row by row", { skip }, () => {
  assert.match(page.note, /F6/);
  assert.match(page.note, /Alt\+Shift/);
  assert.equal(page.menuNav, true);
});
test("F6 and Shift+F6 move between the Panels in screen order and wrap; the Panel that has the focus shows the focus ring", { skip }, () => {
  assert.deepEqual(page.f6, ["chat", "canvas", "right", "chat"]);
  assert.deepEqual(page.shiftF6, ["right", "canvas", "chat"]);
  assert.notEqual(page.ring.style, "none");
});
test("Tab walks the Panels in the order they are on screen, with the borders between them, forward and back", { skip }, () => {
  const names = (walk: string[]) => walk.filter((x) => !x.startsWith("sash:"));
  assert.deepEqual(names(page.tabWalk), ["chat", "canvas", "right"], page.tabWalk.join(" > "));
  assert.deepEqual(names(page.tabBack), ["right", "canvas", "chat"], page.tabBack.join(" > "));
  assert.equal(page.tabWalk.filter((x: string) => x.startsWith("sash:")).length, 2, "the two borders are stops of the walk");
});
test("the borders are separators with a label and a value, and the arrow keys move them by 20 pixels, 100 with Shift, never past the minimum, Home and End go to the ends", { skip }, () => {
  assert.equal(page.sashes.length, 2);
  for (const s of page.sashes) { assert.equal(s.orientation, "vertical"); assert.match(s.label, /Resize/); assert.ok(s.now >= s.min && s.now <= s.max && s.max > s.min, JSON.stringify(s)); assert.equal(s.tabindex, "-1"); }
  assert.match(page.sashes[0].label, /Builder/);
  assert.match(page.sashes[0].label, /Canvas/);
  const r = page.resize;
  assert.ok(Math.abs(r.w1 - r.w0 - 20) <= 2, `20 px: ${r.w0} -> ${r.w1}`);
  assert.ok(Math.abs(r.w2 - r.w1 - 100) <= 2, `100 px with Shift: ${r.w1} -> ${r.w2}`);
  assert.ok(Math.abs(r.w2 - r.w3 - 20) <= 2, `back 20 px: ${r.w2} -> ${r.w3}`);
  // the drawn width of a group is a few pixels more than the size the Panel declares (the library counts the gap into it)
  assert.ok(r.wMin >= r.min - 2 && r.wMin <= r.min + 6 && r.wMin < r.w3, `stops at the minimum ${r.min}: ${r.wMin}`);
  assert.ok(Math.abs(r.now - r.wMin) <= 1, "the value follows the width");
  assert.ok(page.home.w >= r.min - 2 && page.home.w <= r.min + 6, `Home: ${page.home.w} for a minimum of ${r.min}`);
  assert.ok(page.end.w > page.home.w + 50 && page.end.w <= page.end.max + 6, `End: ${page.end.w} of ${page.end.max}`);
  assert.ok(Math.abs(page.end.now - page.end.w) <= 1, "the value follows the width after End too");
});
test("a Panel is moved with Alt+Shift and the arrows (left, right) or Enter (into the tabs of its neighbour); the Canvas never goes into tabs; each move is announced and saved", { skip }, () => {
  assert.deepEqual(page.before, ["chat", "canvas", "right"]);
  assert.deepEqual(page.movedLeft.names, ["chat", "right", "canvas"]);
  assert.match(page.movedLeft.live, /Tutor/);
  assert.deepEqual(page.tabbed.names, ["chat+right", "canvas"]);
  assert.match(page.tabbed.live, /tabs/i);
  assert.deepEqual(page.canvasRefused.names, ["chat+right", "canvas"]);
  assert.match(page.canvasRefused.live, /Canvas/);
  assert.deepEqual(page.movedRight.names, ["chat", "canvas", "right"]);
  assert.deepEqual(page.canvasMoves, ["chat", "right", "canvas"]);
  assert.equal(page.savedDock, true);
  assert.deepEqual(page.liveRegion, { role: "status", live: "polite" });
});
