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

// Layout presets (layout-and-data 09), the page: built-in layouts in the Panels menu, saving the current one under a name, switching, renaming, deleting, and the choice to remember a layout for each Project.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function startProxy(coreUrl: string, project: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)};</script>`;
  const drive = `<script>${readFileSync(new URL("./layout-presets-page.js", import.meta.url), "utf8")}</script>`;
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
  scratch = mkdtempSync(join(tmpdir(), "aidea-layout-presets-"));
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store") });
  const proxy = await startProxy(core.url, fixture("shop"));
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1900,1000", "--virtual-time-budget=60000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 120_000, maxBuffer: 32 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="lp-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(async () => { await core?.plugins.deactivate("run"); core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); });

test("the page loads without errors and uses no native dialog", { skip }, () => {
  assert.deepEqual(page.errors, []);
  assert.equal(page.nativeConfirms, 0);
});
test("the Panels menu lists the built-in layouts, then the actions, with roles a keyboard and a screen reader can use", { skip }, () => {
  assert.deepEqual(page.menu.builtIns, ["Default", "Classic IDE", "Canvas only"]);
  assert.deepEqual(page.menu.actions, ["save", "scope"]);
  assert.deepEqual(page.menu.roles, ["menuitem"]);
});
test("Canvas only hides every Panel, Classic IDE shows Files, Code and the Terminal, and Default brings back the default arrangement", { skip }, () => {
  assert.deepEqual(page.canvasOnly.filter((id: string) => id !== "canvas"), []);
  for (const id of ["chat", "files", "code", "terminal"]) assert.ok(page.classic.includes(id), `classic shows ${id}: ${page.classic}`);
  assert.ok(!page.classic.includes("right") && !page.classic.includes("run"), "the Tutor and Playback are not in the classic arrangement");
  assert.ok(page.default.includes("chat") && page.default.includes("right") && !page.default.includes("files") && !page.default.includes("code"), page.default.join());
});
test("saving asks for a name in a dialog, refuses a built-in name and an empty one by saying why, and keeps the layout under the name", { skip }, () => {
  assert.equal(page.promptFocus, true);
  assert.deepEqual([page.refusedBuiltIn.stillOpen, page.refusedEmpty.stillOpen], [true, true]);
  assert.match(page.refusedBuiltIn.error, /built-in/i);
  assert.match(page.refusedEmpty.error, /name/i);
  assert.deepEqual(page.afterSave.rows, ["Default", "Classic IDE", "Canvas only", "My work"]);
  assert.deepEqual(page.afterSave.served, ["My work"]);
});
test("choosing a saved layout brings the arrangement back in one click", { skip }, () => {
  assert.deepEqual(page.beforeSwitch.filter((id: string) => id !== "canvas"), []);
  assert.deepEqual(page.afterSwitch, page.classic);
});
test("the person's layouts can be renamed and deleted (after a question that names it), and the core keeps each change", { skip }, () => {
  assert.deepEqual(page.manage.names, ["My work"]);
  assert.deepEqual([page.renamed.names, page.renamed.served], [["Work"], ["Work"]]);
  assert.equal(page.deleteAsks, true);
  assert.deepEqual([page.deleted.names, page.deleted.served], [[], []]);
});
test("a layout can be remembered for each Project instead of shared: the choice and this Project's layout reach the core, and the choice goes back", { skip }, () => {
  assert.equal(page.scopeStart, "false");
  assert.equal(page.scopeProject.scope, "project");
  assert.equal(page.scopeProject.mine, true);
  assert.equal(page.scopeBack, "shared");
});
