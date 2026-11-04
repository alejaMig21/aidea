import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, request } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { after, before, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// Run-and-terminal 10, the page: "Ask the Builder for a recipe" asks through the chat, the proposal is drawn as a card, and Accept writes the recipe.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let project = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;
const asked: string[] = [];

// A stand-in for the Builder: when asked for a recipe it proposes one for the db program of the project.
const asBuilder: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ permission, message }): AsyncGenerator<AgentEvent> {
    asked.push(message);
    const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
    const rpc = (method: string, params: unknown, id?: number) => fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } }, 1);
    await rpc("notifications/initialized", {});
    await rpc("tools/call", { name: "propose_run_recipe", arguments: { parts: [{ name: "db", command: "node db.js", ready: { port: 5432 }, evidence: ["db.js"], env: ["DB_PASSWORD"] }] } }, 2);
    yield { type: "text", text: "proposed" };
  },
};

function startProxy(coreUrl: string, projectPath: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(projectPath)};</script>`;
  const drive = `<script>${readFileSync(new URL("./run-recipe-page.js", import.meta.url), "utf8")}</script>`;
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
  scratch = mkdtempSync(join(tmpdir(), "aidea-recipe-page-"));
  project = join(scratch, "project");
  cpSync(fixture("shop"), project, { recursive: true });
  writeFileSync(join(project, "db.js"), 'require("net").createServer().listen(5432, "127.0.0.1");');
  core = await startCore({ port: 0, adapter: asBuilder, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store") });
  const proxy = await startProxy(core.url, project);
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1900,1000", "--virtual-time-budget=40000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 90_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="rr-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(() => { core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });

test("the page loads without errors", { skip }, () => assert.deepEqual(page.errors, []));
test("with no recipe, Play offers to ask the Builder, and asking goes through the chat", { skip }, () => {
  assert.equal(page.askHiddenAtStart, true);
  assert.equal(page.askShown, true);
  assert.equal(page.askHiddenAfter, true);
  assert.match(asked[0], /propose_run_recipe/);
});
test("the proposal is a card with each part, its ready signal, the file it rests on and its variable names, and Accept and Reject", { skip }, () => {
  assert.match(page.card, /db/);
  assert.match(page.card, /node db\.js/);
  assert.match(page.card, /ready when port 5432, shown in db\.js/);
  assert.match(page.card, /DB_PASSWORD/);
  assert.deepEqual(page.buttons, ["Accept", "Reject"]);
});
test("accepting writes .aidea/run.json, says Play will still ask, and closes the card's buttons", { skip }, () => {
  assert.match(page.afterAccept, /Play will ask you/);
  assert.equal(page.buttonsDisabled, true);
  const written = JSON.parse(readFileSync(join(project, ".aidea", "run.json"), "utf8"));
  assert.equal(written.parts[0].name, "db");
  assert.deepEqual(written.parts[0].env, ["DB_PASSWORD"]);
  assert.equal(written.parts[0].evidence, undefined);
});
