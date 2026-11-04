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

// Run-and-terminal 11, the page: text selected in a Terminal tab gets the 8000 character limit and keeps its END; elsewhere the limit stays 2000.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function startProxy(coreUrl: string, project: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)};</script>`;
  const drive = `<script>${readFileSync(new URL("./terminal-select-page.js", import.meta.url), "utf8")}</script>`;
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
  scratch = mkdtempSync(join(tmpdir(), "aidea-terminal-select-"));
  const project = join(scratch, "project");
  cpSync(fixture("shop"), project, { recursive: true });
  writeFileSync(join(project, "talk.js"), 'for (let i = 0; i < 400; i++) console.log("line " + i + " " + "y".repeat(30)); setInterval(() => {}, 1000);');
  mkdirSync(join(project, ".aidea"), { recursive: true });
  writeFileSync(join(project, ".aidea", "run.json"), JSON.stringify({ parts: [{ name: "talk", command: "node talk.js" }] }));
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store") });
  const proxy = await startProxy(core.url, project);
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1900,1000", "--virtual-time-budget=40000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 90_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="ts-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(async () => { await core?.plugins.deactivate("run"); /* core.close() does not stop what Play started: a left program keeps the test alive */ core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); });

test("the page loads without errors and the terminal log is marked as the terminal", { skip }, () => {
  assert.deepEqual(page.errors, []);
  assert.equal(page.marked, true);
  assert.ok(page.terminalLength > 8000, `the output is ${page.terminalLength} characters`);
});
test("a selection of more than 8000 characters in the terminal keeps its END, the buttons stay usable and the control says it cut", { skip }, () => {
  assert.deepEqual(page.longButtons, { Explain: true, Fix: true, "Explain and fix": true, "Enter the Tutor": true }); // the terminal also offers the two that hand the text to the Builder (ticket 12)
  assert.match(page.longHint, /last 8000/);
  assert.deepEqual({ ...page.longSent, endsLikeTheOutput: page.longSent.endsLikeTheOutput }, { source: "terminal", length: 8000, endsLikeTheOutput: true });
});
test("a short selection in the terminal is sent whole, as terminal text, with no cut notice", { skip }, () => {
  assert.equal(page.shortHint, true);
  assert.deepEqual(page.shortSent, { source: "terminal", length: 40 });
});
test("text selected anywhere else keeps the 2000 character limit: the control refuses and sends nothing", { skip }, () => {
  assert.equal(page.elsewhere.buttons.Explain, false);
  assert.match(page.elsewhere.hint, /up to 2000/);
  assert.equal(page.requestsAfterElsewhere, 2);
});
