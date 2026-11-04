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

// Run-and-terminal 12, the page: Fix and Explain and fix appear in the terminal and the Code panel only; they hand the text to the Builder as a fix.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function startProxy(coreUrl: string, project: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)};</script>`;
  const drive = `<script>${readFileSync(new URL("./fix-buttons-page.js", import.meta.url), "utf8")}</script>`;
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
  scratch = mkdtempSync(join(tmpdir(), "aidea-fix-buttons-"));
  const project = join(scratch, "project");
  cpSync(fixture("shop"), project, { recursive: true });
  writeFileSync(join(project, "talk.js"), 'for (let i = 0; i < 40; i++) console.log("line " + i + " something went wrong"); setInterval(() => {}, 1000);');
  mkdirSync(join(project, ".aidea"), { recursive: true });
  writeFileSync(join(project, ".aidea", "run.json"), JSON.stringify({ parts: [{ name: "talk", command: "node talk.js" }] }));
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store") });
  const proxy = await startProxy(core.url, project);
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1900,1000", "--virtual-time-budget=40000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 90_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="fb-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(async () => { await core?.plugins.deactivate("run"); /* core.close() does not stop what Play started: a left program keeps the test alive */ core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); });

const FOUR = ["Explain", "Fix", "Explain and fix", "Enter the Tutor"];
test("the page loads without errors", { skip }, () => assert.deepEqual(page.errors, []));
test("the terminal and the Code panel show four buttons; every other place shows two", { skip }, () => {
  assert.deepEqual(page.terminalButtons, FOUR);
  assert.deepEqual(page.codeButtons, FOUR);
  assert.deepEqual(page.otherButtons, ["Explain", "Enter the Tutor"]);
});
test("Fix sends the selection to the Builder as a fix (data, not a message) and does not ask the Tutor; the chat says what was sent", { skip }, () => {
  assert.equal(page.fix.chats, 1);
  assert.equal(page.fix.defined, 0);
  assert.equal(page.fix.exact, true);
  assert.equal(page.fix.hasMessage, false);
  assert.equal(page.fix.body.fix.source, "terminal");
  assert.equal(page.chatShows, true);
});
test("Explain and fix asks the Tutor to explain and the Builder to fix, from the same selection", { skip }, () => assert.deepEqual(page.both, { chats: 2, defined: 1, source: null }));
test("a selection that looks like a secret asks before Fix sends anything", { skip }, () => {
  assert.equal(page.secretAsked, true);
  assert.equal(page.secretSentEarly, false);
  assert.equal(page.secretSentAfter, 1);
});
