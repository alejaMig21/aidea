import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, before, test } from "node:test";
import { startCore } from "../src/core/server.ts";

// language-plugins 04: with no plugin that reads the language of a Project, the Components layer says so in plain words, names the language and offers a lesson; nothing is prepared or sent for the person.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function startProxy(coreUrl: string, project: string) {
  const target = new URL(coreUrl);
  const drive = `<script>${readFileSync(new URL("./language-offer-page.js", import.meta.url), "utf8").replace("__PROJECT__", () => JSON.stringify(project))}</script>`;
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
  scratch = mkdtempSync(join(tmpdir(), "aidea-language-offer-page-"));
  const project = join(scratch, "stats");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(project, { recursive: true });
  writeFileSync(join(project, "analysis.r"), "x <- 1\n");
  core = await startCore({ port: 0, builtinPluginsDir: false, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store") });
  const proxy = await startProxy(core.url, project);
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1400,900", "--virtual-time-budget=20000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 90_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="lo-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(() => { core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); });

test("the page loads without errors", { skip }, () => assert.deepEqual(page.errors, []));
test("the Components layer says no plugin reads R, keeps the written layers, and offers a lesson that sends nothing for the person", { skip }, () => {
  assert.equal(page.hidden, false);
  assert.match(page.text, /No plugin reads R/);
  assert.match(page.text, /Business, Requirements and Architecture still work/);
  assert.match(page.languages, /Not analysed yet: R, 1 file/);
  assert.equal(page.button, "Learn how to ask for a plugin for R");
  assert.equal(page.started.payload.guide, true);
  assert.match(page.started.payload.message, /Teach me how to ask for a plugin that reads R/);
  assert.equal(page.chat, "", "nothing was written in the Builder's chat for the person");
});
