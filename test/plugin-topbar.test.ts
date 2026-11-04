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
import { fixture } from "./helpers.ts";

// A plugin adds a control to the top bar (slot layout.topbar) and talks to its own host half through ui.call.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function startProxy(coreUrl: string, project: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)};</script>`;
  const drive = `<script>${readFileSync(new URL("./plugin-topbar-page.js", import.meta.url), "utf8")}</script>`;
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
  scratch = mkdtempSync(join(tmpdir(), "aidea-topbar-"));
  const store = join(scratch, "store", "bar");
  mkdirSync(store, { recursive: true });
  writeFileSync(join(store, "aidea-plugin.json"), JSON.stringify({ id: "fixture.bar", version: "1.0.0", title: "Bar", description: "x", publisher: "t", api: "0.1", main: "main.js", ui: "ui.js" }));
  writeFileSync(join(store, "main.js"), `export function activate(ctx) { ctx.api.handle("go", (b) => { if (b.fail) throw new Error("it broke"); return { said: "hello " + b.name }; }); }`);
  writeFileSync(join(store, "ui.js"), `export function activate(ui) {
    return ui.slots.add("layout.topbar", { id: "go", render(box) {
      const button = document.createElement("button"), out = document.createElement("output");
      button.textContent = "Go";
      button.onclick = async () => { try { out.textContent = (await ui.call("go", { name: "bar", fail: button.dataset.fail === "1" })).said; } catch (e) { out.textContent = e.message; } };
      box.append(button, out);
    } });
  }`);
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store"), builtinPluginsDir: false });
  const proxy = await startProxy(core.url, fixture("shop"));
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1900,1000", "--virtual-time-budget=30000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 90_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="tb-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(() => { core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });

test("the page loads without errors", { skip }, () => assert.deepEqual(page.errors, []));
test("a plugin's control is in the top bar, before the Plugins button", { skip }, () => assert.deepEqual(page.placed, { present: true, inHeader: true, beforePluginsButton: true }));
test("ui.call reaches the host half and shows its answer; a failing handler shows its message", { skip }, () => {
  assert.equal(page.called, "hello bar");
  assert.equal(page.failed, "it broke");
});
test("switching the plugin off removes its control", { skip }, () => assert.equal(page.gone, true));
