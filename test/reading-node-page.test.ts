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

// layout-and-data 05: files and Nodes select each other, and the Node whose code is being read shows it (a ring and the word READING: readable without colour). One Node at a time.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function startProxy(coreUrl: string, project: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)};</script>`;
  const drive = `<script>${readFileSync(new URL("./reading-node-page.js", import.meta.url), "utf8")}</script>`;
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
  scratch = mkdtempSync(join(tmpdir(), "aidea-reading-node-"));
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store") });
  const proxy = await startProxy(core.url, fixture("shop"));
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1900,1000", "--virtual-time-budget=60000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 120_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="rn-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(async () => { await core?.plugins.deactivate("run"); core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); });

test("the page loads without errors, and nothing carries the sign before any code is read", { skip }, () => {
  assert.deepEqual(page.errors, []);
  assert.deepEqual(page.start, { rects: [], tags: [] });
  assert.ok(page.nodes.cartModule && page.nodes.mainModule && page.nodes.cartClass, JSON.stringify(page.nodes));
});
test("choosing a file that is a Node selects that Node, shows the sign on it, and the Details name it", { skip }, () => {
  assert.ok(page.fileIsNode.signs.rects.includes(page.nodes.cartModule), JSON.stringify(page.fileIsNode));
  assert.deepEqual(page.fileIsNode.signs.tags, ["READING"]);
  assert.equal(page.fileIsNode.selected, page.nodes.cartModule);
  assert.match(page.fileIsNode.details, /cart/i);
});
test("choosing a Node moves the sign to it, and only one Node carries it at a time", { skip }, () => {
  assert.deepEqual([...new Set(page.nodeChosen.signs.rects)], [page.nodes.cartClass]);
  assert.deepEqual(page.nodeChosen.signs.tags, ["READING"]);
  assert.deepEqual([...new Set(page.otherFile.signs.rects)], [page.nodes.mainModule]);
  assert.deepEqual(page.otherFile.signs.tags, ["READING"]);
});
test("a file that is not a Node on the Canvas clears the sign, and so does a layer where the Node is not drawn; coming back brings it back", { skip }, () => {
  assert.deepEqual(page.notANode.signs, { rects: [], tags: [] });
  assert.deepEqual(page.otherLayer.signs, { rects: [], tags: [] });
  assert.ok(page.backOnComponents.signs.rects.length > 0);
  assert.deepEqual(page.backOnComponents.signs.tags, ["READING"]);
});
test("the sign is readable without colour: a word of at least 11px and a line thicker than the Node's own", { skip }, () => {
  assert.ok(page.look.strokeWidth >= 2, `stroke ${page.look.strokeWidth}`);
  assert.equal(page.look.tag, "READING");
  assert.ok(page.look.tagSize >= 11, `tag ${page.look.tagSize}px`);
});
test("selecting a Node on the Canvas opens its code at once when the Code panel is on screen, and only offers View code when it is hidden", { skip }, () => {
  assert.equal(page.hiddenNow, true);
  assert.deepEqual(page.selectHidden, { opened: false, viewButton: true, stillHidden: true });
  assert.equal(page.shownNow, true);
  assert.equal(page.selectShown.opened, true);
  assert.ok(page.selectShown.signs.rects.includes(page.nodes.cartClass));
});
