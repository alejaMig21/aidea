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

// layout-and-data 14: the Data layer draws the variables of a function while it is played: a list as a row of cells with places, a dictionary as keys pointing to values, a scalar as a labelled
// box; what changed is highlighted; Flow and Data follow the one Playback position; a big list is cut at the limit; a recording with no values gets a plain statement.
const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"].find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

let scratch = "";
let core: Awaited<ReturnType<typeof startCore>>;
let page: any;

function startProxy(coreUrl: string, project: string) {
  const target = new URL(coreUrl);
  const seed = `<script>window.DATA_PROJECT = ${JSON.stringify(project)};</script>`;
  const drive = `<script>${readFileSync(new URL("./data-layer-page.js", import.meta.url), "utf8")}</script>`;
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
  scratch = mkdtempSync(join(tmpdir(), "aidea-data-layer-"));
  const project = join(scratch, "project");
  mkdirSync(project, { recursive: true });
  writeFileSync(join(project, "tally.py"), `def tally(words):
    counts = {}
    seen = []
    for w in words:
        counts[w] = counts.get(w, 0) + 1
        seen.append(w)
    return counts


def build(n):
    items = list(range(n))
    total = len(items)
    return total


class Cell:
    def __init__(self, value, next=None):
        self.value = value
        self.next = next


class Tree:
    def __init__(self, key, left=None, right=None):
        self.key = key
        self.left = left
        self.right = right


def chain():
    c = Cell(3)
    b = Cell(2, c)
    head = Cell(1, b)
    spare = Cell(9)
    b.next = spare
    return head.value


def ring():
    a = Cell(1)
    b = Cell(2, a)
    a.next = b
    return a.value


def alias():
    shared = Cell(7)
    first = Cell(1, shared)
    second = Cell(2, shared)
    return first.value


def tree():
    root = Tree(4, Tree(2, Tree(1), Tree(3)), Tree(6))
    return root.key


def longchain(n):
    head = None
    for i in range(n):
        head = Cell(i, head)
    return head.value
`);
  core = await startCore({ port: 0, recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "preferences.json"), learnerDir: join(scratch, "learner"), pluginsDir: join(scratch, "store") });
  const proxy = await startProxy(core.url, project);
  try {
    const { stdout } = await promisify(execFile)(chrome!, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${join(scratch, "profile")}`, "--window-size=1900,1000", "--virtual-time-budget=120000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`], { timeout: 170_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    const raw = /<pre id="dl-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
    assert.ok(raw, "the page never wrote its report");
    page = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"));
  } finally { proxy.close(); }
});
after(async () => { await core?.plugins.deactivate("run"); core?.close(); if (scratch) rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); });

test("the page loads without errors", { skip }, () => assert.deepEqual(page.errors, []));
test("Data is a layer next to Flow in the layer bar, and cannot be chosen until a function's Flow is open; then it replaces the flowchart", { skip }, () => {
  const order = page.tabs.order as string[];
  assert.equal(order[order.indexOf("flow") + 1], "data", order.join());
  assert.equal(page.tabs.disabledBefore, true);
  assert.equal(page.afterFlow.disabled, false);
  assert.equal(page.shownData.layer, "data");
  assert.equal(page.shownData.dataVisible, true);
  assert.equal(page.shownData.flowHidden, true);
  assert.match(page.shownData.note, /Play/i, "before a run it says what to do");
});
test("each variable is drawn: a list as cells with their places, a dictionary as keys pointing to values", { skip }, () => {
  assert.deepEqual(page.last.vars, ["words", "counts", "seen", "w"]);
  assert.equal(page.last.wordsCells, 3);
  assert.equal(page.last.wordsPositions, "0,1,2");
  assert.equal(page.last.countsPairs, 2);
  assert.match(page.last.countsText, /a/);
  assert.match(page.last.countsText, /b/);
  assert.equal(page.last.seenCells, 3);
});
test("Flow and Data follow one Playback position, and the variable that changed is marked in words as well as by its look", { skip }, () => {
  assert.equal(page.together.flowNow, true);
  assert.deepEqual(page.together.changedVars, page.together.expectedChanged);
  assert.ok(page.together.changedVars.length > 0);
  assert.deepEqual(page.together.tags, page.together.changedVars.map(() => "CHANGED"));
  assert.ok(page.first.vars.includes("words"));
});
test("the legend of Data has a row for what is drawn, and every row matches something on screen", { skip }, () => {
  assert.ok(page.legend.length >= 4, JSON.stringify(page.legend));
  assert.deepEqual(page.legend.filter((r: any) => r.matches === 0).map((r: any) => r.text), []);
});
test("a linked list is nodes and arrows: each object once, a name and a field each with an arrow, and the step that rewires a pointer shows the new arrow and the old one", { skip }, () => {
  assert.equal(page.chain.nodesMax, 4, JSON.stringify(page.chain));
  assert.equal(page.chain.edgesMax, 6, "four names and two pointers between objects");
  assert.ok(page.chain.rewiredMax >= 1, "NEW arrow");
  assert.ok(page.chain.oldMax >= 1, "WAS arrow");
  assert.ok(page.chain.tagWords.includes("NEW") && page.chain.tagWords.includes("WAS"), "the arrows say so in words too");
});
test("a cycle is drawn without looping: two objects, a pointer back", { skip }, () => {
  assert.equal(page.ring.nodesMax, 2, JSON.stringify(page.ring));
  assert.equal(page.ring.edgesMax, 4, "two names and two pointers, one of them back");
});
test("an object reachable from three places is drawn once with three arrows into it", { skip }, () => {
  assert.equal(page.alias.nodesMax, 3, JSON.stringify(page.alias));
  assert.equal(page.alias.intoMax, 3);
});
test("a binary tree is drawn as a tree: children one column right, the parent between them", { skip }, () => {
  assert.equal(page.tree.nodesMax, 5, JSON.stringify(page.tree));
  assert.ok(page.tree.rootX < page.tree.leftX && page.tree.rootX < page.tree.rightX);
  assert.ok(page.tree.leftY < page.tree.rootY && page.tree.rootY < page.tree.rightY);
});
test("a chain deeper than the limit is cut, and the cut says which limit", { skip }, () => {
  assert.match(page.longchain.cuts, /depth limit/i, JSON.stringify(page.longchain));
});
test("a list of 10,000 items is cut at the limit with 'N more hidden', and drawing it stays quick", { skip }, () => {
  assert.equal(page.big.cells, 100);
  assert.deepEqual(page.big.hidden, ["9,900 more hidden"]);
  assert.ok(page.big.elapsedMs < 1500, `two steps took ${page.big.elapsedMs} ms`);
});
test("a recording with no values says so plainly instead of drawing an empty layer", { skip }, () => {
  assert.match(page.noValues.note, /does not record|no values|cannot record/i);
  assert.equal(page.noValues.vars, 0);
});
