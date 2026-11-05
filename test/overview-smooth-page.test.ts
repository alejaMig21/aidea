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

// big-projects 02: the Components overview of a big Project stays smooth to move. Measured on Telegram with its tests open (400 lines): 17 frames per second,
// against 53 with the tests closed. The lines were the cost: each one faint by `opacity` (a layer of its own) and with an arrowhead drawn at any zoom. A headless
// browser with a virtual clock cannot count frames, so this test guards the causes; the frames per second are measured live in Electron
// (`.scratch/big-projects/live-scripts/overview-fps.mjs`).
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function startProxy(coreUrl: string, project: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.BIG_PROJECT = ${JSON.stringify(project)};</script>`;
  const drive = `<script>${readFileSync(new URL("./overview-smooth-page.js", import.meta.url), "utf8")}</script>`;
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
  scratch = mkdtempSync(join(tmpdir(), "aidea-overview-smooth-"));
  const project = join(scratch, "project");
  // 150 modules in 6 folders; each calls four others, so there are more than 400 pairs and the overview draws the 400 strongest.
  for (let m = 0; m < 150; m++) {
    const dir = join(project, `pkg_${m % 6}`);
    mkdirSync(dir, { recursive: true });
    const imports = [1, 7, 13, 29].map((d) => `from pkg_${(m + d) % 6}.mod_${(m + d) % 150} import run_${(m + d) % 150}`);
    writeFileSync(join(dir, `mod_${m}.py`), [...imports, "", `def run_${m}(x):`, ...[1, 7, 13, 29].map((d) => `    run_${(m + d) % 150}(x)`), "    return x", ""].join("\n"));
  }
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store") });
  const proxy = await startProxy(core.url, project);
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1600,900", "--virtual-time-budget=60000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 120_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="os-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(async () => { await core?.plugins.deactivate("run"); core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); });

test("the page loads without errors", { skip }, () => assert.deepEqual(page.errors, [], JSON.stringify(page.debug)));
test("the overview draws the 400 strongest lines, faint by stroke-opacity (not opacity) and with no arrowhead at the fitted zoom", { skip }, () => {
  assert.equal(page.edges, 400);
  assert.equal(page.faint.opacity, "1", "an element with opacity under 1 is drawn on a layer of its own");
  assert.equal(Number(page.faint.strokeOpacity), 0.15);
  assert.equal(page.faint.heads, false, JSON.stringify(page.faint));
  assert.equal(page.faint.markerEnd, "none");
});
test("zoomed in far enough to read an arrowhead, the heads are drawn; hovering a module lights its lines fully and leaves the others faint", { skip }, () => {
  assert.equal(page.zoomedIn.heads, true, JSON.stringify(page.zoomedIn));
  assert.notEqual(page.zoomedIn.markerEnd, "none");
  assert.ok(page.lit.count > 0, "the module has lines");
  assert.equal(Number(page.lit.strokeOpacity), 1);
  assert.ok(Number(page.lit.others) < 0.5, `the others are ${page.lit.others}`);
});
