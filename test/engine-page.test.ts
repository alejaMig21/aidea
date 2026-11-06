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

// animation-and-data 08: the animation engine draws a recording of whole pictures handed to it by a fixture that is not Data; what changed is found by comparing two pictures.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function startProxy(coreUrl: string) {
  const target = new URL(coreUrl);
  const drive = `<script>${readFileSync(new URL("./engine-page.js", import.meta.url), "utf8")}</script>`;
  return new Promise<Server>((resolve) => {
    const server = createServer((req, res) => {
      const { origin: _origin, ...headers } = req.headers;
      const up = request({ host: target.hostname, port: target.port, method: req.method, path: req.url, headers: { ...headers, host: target.host } }, (answer) => {
        if (req.url !== "/") { res.writeHead(answer.statusCode ?? 502, answer.headers); answer.pipe(res); return; }
        let html = "";
        answer.setEncoding("utf8").on("data", (c) => (html += c)).on("end", () => {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(html.replace("</body>", () => `${drive}</body>`));
        });
      });
      req.pipe(up);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

before(async () => {
  if (skip) return;
  scratch = mkdtempSync(join(tmpdir(), "aidea-engine-"));
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store") });
  const proxy = await startProxy(core.url);
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1900,1000", "--virtual-time-budget=60000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="en-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(async () => { core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); });

test("the page loads without errors", { skip }, () => assert.deepEqual(page.errors, []));
test("a picture of a list is drawn: one piece, one cell per element, nothing marked on the first step", { skip }, () => {
  assert.deepEqual(page.first.pieces, ["L"]);
  assert.deepEqual(page.first.cells, ["a", "b"]);
  assert.deepEqual(page.first.tags, []);
});
test("an element that was not in the step before is NEW, found by comparing the two pictures, and the word is drawn too", { skip }, () => {
  assert.deepEqual(page.appended.cells, ["a", "b", "c"]);
  assert.deepEqual(page.appended.isNew, ["c"]);
  assert.deepEqual(page.appended.tags, ["c:NEW"]);
});
test("an element with the same id and another value is CHANGED; one that only moved is not marked", { skip }, () => {
  assert.deepEqual(page.swapped.cells, ["b", "a", "c"]);
  assert.deepEqual(page.swapped.changed, ["c"]);
  assert.deepEqual(page.swapped.isNew, []);
  assert.deepEqual(page.swapped.tags, ["c:CHANGED"]);
});
test("a changed element also says what it was, in words", { skip }, () => assert.deepEqual(page.swapped.was, ["c:WAS 3"]));
test("a piece that was cut says how many are missing, drawn by the engine", { skip }, () => {
  assert.deepEqual(page.cut.notes, ["… and 9,900 more"]);
  assert.equal(page.cut.text, "big = [1, 2, … and 9,900 more]");
});
test("the text form of a picture and the picture saved as an image come from the engine", { skip }, () => {
  assert.equal(page.text, "items = [2, 1, 9]");
  assert.deepEqual(page.image, { isSvg: true, noVars: true, cells: 3 });
});
test("a piece added through the registry is drawn, compared and written as text like the others", { skip }, () => {
  assert.deepEqual(page.dots, { drawn: ["p", "q"], isNew: ["q"], text: "1 2" });
});
test("a plugin adds a piece through the slot engine.piece; a kind that exists or an incomplete entry is refused; removing the entry removes the piece", { skip }, () => {
  assert.deepEqual(page.slot, { declared: true, during: 2, after: 0, duplicate: true, incomplete: true });
});
test("one step forward animates over a fraction of the Playback speed; Animations off, a jump or going back is a plain change", { skip }, () => {
  assert.ok(page.motion.forward.count > 0, JSON.stringify(page.motion));
  assert.ok(page.motion.forward.durations.every((d: number) => d > 0 && d < 600), "less than one step at Normal (600 ms)");
  assert.equal(page.motion.off.count, 0);
  assert.equal(page.motion.jump.count, 0);
  assert.equal(page.motion.back.count, 0);
});
