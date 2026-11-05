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

// run-and-terminal 06 and 07 (the boxes left open by the audit): Play's failure message offers to open the Terminal and does so on request; the Stop and Restart buttons of a tab act on their own part.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function projectWith(name: string, recipe: unknown) {
  const dir = join(scratch, name);
  cpSync(fixture("shop"), dir, { recursive: true });
  mkdirSync(join(dir, ".aidea"), { recursive: true });
  writeFileSync(join(dir, ".aidea", "run.json"), JSON.stringify(recipe));
  return dir;
}

function startProxy(coreUrl: string, fail: string, wait: string) {
  const target = new URL(coreUrl);
  const drive = `<script>${readFileSync(new URL("./run-terminal-page.js", import.meta.url), "utf8").replace("__FAIL__", () => JSON.stringify(fail)).replace("__WAIT__", () => JSON.stringify(wait))}</script>`;
  return new Promise<Server>((resolve) => {
    const server = createServer((req, res) => {
      const { origin: _origin, ...headers } = req.headers;
      const up = request({ host: target.hostname, port: target.port, method: req.method, path: req.url, headers: { ...headers, host: target.host } }, (answer) => {
        if (req.url !== "/") { res.writeHead(answer.statusCode ?? 502, answer.headers); answer.pipe(res); return; }
        let html = "";
        answer.setEncoding("utf8").on("data", (c) => (html += c)).on("end", () => { res.writeHead(200, { "content-type": "text/html; charset=utf-8" }); res.end(html.replace("</body>", () => `${drive}</body>`)); });
      });
      req.pipe(up);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

before(async () => {
  if (skip) return;
  scratch = mkdtempSync(join(tmpdir(), "aidea-run-terminal-page-"));
  const fail = projectWith("fail", { parts: [{ name: "broken", command: `node -e "process.exit(3)"`, ready: { line: "never printed" } }] });
  const wait = projectWith("wait", { parts: [{ name: "waiter", command: `node -e "setInterval(() => {}, 1000)"` }] });
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store") });
  const proxy = await startProxy(core.url, fail, wait);
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1400,900", "--virtual-time-budget=60000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 120_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="rt-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(async () => { await core?.plugins.deactivate("run"); core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 }); });

test("the page loads without errors", { skip }, () => assert.deepEqual(page.errors, []));
test("Play's failure message names the part and offers to open the Terminal, and the offer shows it", { skip }, () => {
  assert.match(page.failMessage, /broken/);
  assert.equal(page.openOffered, true);
  assert.equal(page.terminalBefore, false, "the Terminal starts hidden");
  assert.equal(page.terminalAfter, true);
  assert.equal(page.openHiddenAfter, true, "the offer goes away once used");
});
test("a tab's Stop ends its part and its Restart starts it again", { skip }, () => {
  assert.equal(page.runningTab, true);
  assert.equal(page.stoppedTab, true);
  assert.equal(page.restartedTab, true);
});
