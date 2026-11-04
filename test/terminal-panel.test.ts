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

// Ticket run-and-terminal/03: the Layout has a bottom zone, full width, and the Terminal Panel starts there. Five loads of the real page in headless Chrome.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

// A save from before the Terminal existed.
const LEGACY = JSON.stringify({ chatFolded: false, filesFolded: false, codeFolded: true, runFolded: false, rightFolded: false, canvasFolded: false, sized: { chat: true }, chat: 300 });
let showR: any, reopenR: any, stripR: any, stripReopenR: any, beforeR: any;
let scratch = "";

function startProxy(coreUrl: string, project: string, mode: string, stored: string | null) {
  const target = new URL(coreUrl);
  const seed = `<script>window.PANELS_PROJECT = ${JSON.stringify(project)}; window.TERM_MODE = ${JSON.stringify(mode)}; ${stored ? `localStorage.setItem("aidea.layout", ${JSON.stringify(stored)});` : ""}</script>`;
  const drive = `<script>${readFileSync(new URL("./terminal-panel-page.js", import.meta.url), "utf8")}</script>`;
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

// Every load uses a new browser profile and a new address, so only the core can hand a saved Layout over (a relaunched desktop app is the same).
async function load(core: Awaited<ReturnType<typeof startCore>>, mode: string, stored: string | null = null) {
  const proxy = await startProxy(core.url, fixture("shop"), mode, stored);
  try {
    const { stdout } = await promisify(execFile)(chrome!, [
      "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile-" + mode)}`, "--window-size=1900,1000",
      "--virtual-time-budget=30000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`,
    ], { timeout: 90_000, maxBuffer: 16 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="term-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, `the page never wrote its report (${mode})`);
    const text = raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
    if (process.env.AIDEA_DEBUG_PAGE) console.log(text);
    return JSON.parse(text);
  } finally { proxy.close(); }
}

before(async () => {
  if (skip) return;
  scratch = mkdtempSync(join(tmpdir(), "aidea-term-"));
  const opts = (name: string) => ({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, `${name}.json`), learnerDir: join(scratch, "learner") });
  for (const name of ["a", "b", "c"]) {
    const core = await startCore(opts(name));
    try {
      if (name === "a") { showR = await load(core, "show"); reopenR = await load(core, "reopen"); }
      if (name === "b") { stripR = await load(core, "strip"); stripReopenR = await load(core, "stripReopen"); }
      if (name === "c") beforeR = await load(core, "before", LEGACY);
    } finally { core.close(); }
  }
});

after(() => {
  if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

test("the pages load without errors", { skip }, () => {
  assert.deepEqual([showR.errors, reopenR.errors, stripR.errors, stripReopenR.errors, beforeR.errors], [[], [], [], [], []]);
});

test("Terminal is listed in the Panels menu, unchecked, and is not in the window at start", { skip }, () => {
  assert.equal(showR.menu.present, true);
  assert.equal(showR.menu.checked, "false");
  assert.equal(showR.start.ids.includes("terminal"), false);
});

test("shown for the first time it stands alone in a full-width strip below every other Panel, with a message that says what it will show", { skip }, () => {
  const s = showR.shown;
  assert.deepEqual([s.inDock, s.alone, s.fullWidth, s.below], [true, true, true, true]);
  assert.ok(s.text > 20, "the empty Terminal says what it will show");
  for (const id of showR.start.ids) assert.ok(s.ids.includes(id), `${id} is still on screen`);
  assert.ok(s.canvas < showR.start.canvas, "the strip takes its height from the Canvas");
});

test("hiding the Terminal gives the Canvas its height back and saves the Terminal as hidden", { skip }, () => {
  assert.equal(showR.hidden.ids.includes("terminal"), false);
  assert.ok(Math.abs(showR.hidden.canvas - showR.start.canvas) <= 3, `${showR.hidden.canvas} vs ${showR.start.canvas}`);
  assert.equal(showR.hidden.folded, true);
});

test("the Terminal can be moved like any Panel, and hiding then showing it puts it back where it was left", { skip }, () => {
  assert.equal(showR.moved.withChat, true);
  assert.equal(showR.back.withChat, true);
});

test("a restart restores the place where the Terminal was left", { skip }, () => {
  assert.equal(reopenR.opened.inDock, true);
  assert.equal(reopenR.opened.withChat, true);
});

test("a restart restores the Terminal in the bottom strip", { skip }, () => {
  const s = stripR.strip, o = stripReopenR.opened;
  assert.deepEqual([s.inDock, s.alone, s.fullWidth, s.below], [true, true, true, true]);
  assert.deepEqual([o.inDock, o.alone, o.fullWidth, o.below], [true, true, true, true]);
});

test("a Layout saved before the Terminal existed still restores, with the Terminal hidden", { skip }, () => {
  assert.deepEqual(beforeR.before, { present: true, checked: "false", inDock: false });
});
