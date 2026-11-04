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

// Ticket plugin-system/04: the Terminal Panel is a plugin that ships with aidea and uses the same API as an installed one. Its behaviour is tested by terminal-panel.test.ts, unchanged.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function startProxy(coreUrl: string, project: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)};</script>`;
  const drive = `<script>${readFileSync(new URL("./terminal-plugin-page.js", import.meta.url), "utf8")}</script>`;
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
  scratch = mkdtempSync(join(tmpdir(), "aidea-termplug-"));
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner") });
  if (skip) return;
  const proxy = await startProxy(core.url, fixture("shop"));
  try {
    const { stdout } = await promisify(execFile)(chrome!, [
      "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1900,1000",
      "--virtual-time-budget=30000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`,
    ], { timeout: 90_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="tp-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});

after(() => {
  core?.close();
  if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test("the core lists the Terminal as a plugin that ships with aidea, active, with an interface half", async () => {
  const { plugins } = (await (await fetch(core.url + "/plugins")).json()) as { plugins: any[] };
  const t = plugins.find((p) => p.id === "terminal");
  assert.deepEqual([t?.state, t?.ui, t?.builtin], ["active", true, true]);
});

test("the page loads without errors and shows the Terminal in the Panels menu, unchecked", { skip }, () => {
  assert.deepEqual(page.errors, []);
  assert.deepEqual([page.menu.row, page.menu.checked], [true, "false"]);
  assert.equal(page.shown.inDock, true);
});

test("disabling the plugin removes the Terminal and its menu row; a Layout saved with the Terminal in it still restores", { skip }, () => {
  assert.deepEqual([page.disabled.inDock, page.disabled.row, page.disabled.core], [false, false, true]);
  assert.ok(page.restored.inDock.includes("canvas") && page.restored.inDock.includes("chat") && !page.restored.inDock.includes("terminal"));
  assert.equal(page.restored.canvasShown, true);
});

test("enabling it again brings the menu row back", { skip }, () => {
  assert.equal(page.back.row, true);
});
