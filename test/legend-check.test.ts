import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, request } from "node:http";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture, viaCore } from "./helpers.ts";

// Opens the legend-check Project (one example of everything each layer can draw) in a headless Chrome, shows the five layers and
// compares each layer's "?" legend with what was really drawn, both ways. The page side is legend-check-page.js.
// A legend row is [swatch, text, selector] (see 45-notation.js): the selector must match something the layer drew. A row that cannot
// be matched (it explains a state) is [swatch, text, null, "reason"].

type Row = { text: string; selector: string | null; why: string | null; matches: number };
type LayerReport = { rows: Row[]; colours: string[]; drawnTones: string[]; uncovered: Record<string, string> };
type Report = { layers: Record<string, LayerReport>; errors: string[]; recording?: { steps: number; error?: string } };

// Class tokens drawn that no legend row names, matches or contains: structural, each with its reason.
// A token not listed here, and not covered by a row, fails the test as "drawn kind ... has no legend entry".
const packet = { "nt-packet": "the travelling dot that the arrow row names; it is made by the shared motion kit" };
const ALLOWED: Record<string, Record<string, string>> = {
  business: {},
  requirements: {
    "req-group": "the column heading above the functional or the non-functional cards",
  },
  architecture: {
    "pattern-under": "layout wrapper of the pattern drawing: its parts are the boundary, title and role tags",
    "pattern-over": "layout wrapper of the pattern drawing: its parts are the violation arrows",
    "pattern-title": "the name of a pattern group, written on its boundary (the Pattern group row)",
    "pattern-role": "the role tag on a member of a pattern group (the Pattern group row)",
    "arch-label": "the verb written on a relationship (the relationship row)",
    tech: "the [technology] written under the verb of a relationship (the relationship row)",
  },
  components: {
    "cp-tab": "the tab of a package box (the Package row)",
    "cp-pkg-name": "the name written on a package tab (the Package row)",
    "cp-class-name": "the name written on top of a class box (the Class row)",
    "cp-divider": "the line between the compartments of a class box (the Class row)",
    "cp-member": "the text of an attribute, a method or a function (the Visibility row)",
    "cp-hit": "an invisible area over a method that makes it clickable",
    "cp-label": "the word written on a relationship (the relationship rows)",
    "cp-q": "the ? beside an unresolved relationship (the unresolved row)",
  },
  flow: {
    "flow-label": "the exit label written on an edge (the Diamond and Red dashed rows)",
    exception: "the exception type written on a red edge (the Red dashed row)",
    "has-recording": "the state of the whole graph while a Playback is loaded",
  },
};

const chrome = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"]
  .find((p) => p && existsSync(p));
if (!chrome && process.env.AIDEA_REQUIRE_CHROME) throw new Error("AIDEA_REQUIRE_CHROME is set but Chrome was not found (set CHROME_PATH to its executable)");
const skip = chrome ? false : "Chrome was not found (set CHROME_PATH to its executable; set AIDEA_REQUIRE_CHROME=1 to fail instead of skipping)";

// A stand-in for the builder that proposes one Node to add and one to remove, so the Proposal shapes get drawn.
const proposer: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ permission }): AsyncGenerator<AgentEvent> {
    const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
    let id = 1;
    const rpc = (method: string, params: unknown) =>
      fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) }).then((r) => r.json());
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } });
    const cache = { id: "cache", title: "Cache", technology: "Redis", rationale: { why: "Quotes are read far more often than written.", rejected: [] } };
    for (const call of [{ name: "propose_add_node", arguments: { layer: "architecture", node: cache } }, { name: "propose_remove_node", arguments: { layer: "architecture", id: "plan" } }]) {
      await viaCore(core, url, rpc, call);
    }
    yield { type: "text", text: "proposed" };
  },
};

const scratch: string[] = [];
let core: Awaited<ReturnType<typeof startCore>>;
let proxy: Server;
let report: Report;

// The page the person sees, plus the script that drives it: every other request goes to the core untouched.
function startProxy(coreUrl: string, projectId: string) {
  const target = new URL(coreUrl);
  const drive = `<script>window.LEGEND_PROJECT = ${JSON.stringify(projectId)};\n${readFileSync(new URL("./legend-check-page.js", import.meta.url), "utf8")}</script>`;
  return new Promise<Server>((resolve) => {
    const server = createServer((req, res) => {
      const { origin: _origin, ...headers } = req.headers;
      const up = request({ host: target.hostname, port: target.port, method: req.method, path: req.url, headers: { ...headers, host: target.host } }, (answer) => {
        if (req.url !== "/") { res.writeHead(answer.statusCode ?? 502, answer.headers); answer.pipe(res); return; }
        let html = "";
        answer.setEncoding("utf8").on("data", (c) => (html += c)).on("end", () => {
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
          res.end(html.replace("</body>", () => `${drive}</body>`));
        });
      });
      req.pipe(up);
    });
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

before(async () => {
  if (skip) return;
  const dir = mkdtempSync(join(tmpdir(), "aidea-legend-"));
  scratch.push(dir);
  cpSync(fixture("legend-check"), join(dir, "project"), { recursive: true });
  const project = join(dir, "project");
  core = await startCore({ port: 0, adapter: proposer, recentsFile: join(dir, "recents.json"), preferencesFile: join(dir, "preferences.json"), learnerDir: join(dir, "learner") });
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const opened = await (await post("/projects", { path: project })).json();
  await (await post("/chat", { project: opened.id, message: "propose something" })).text(); // the pending Proposals live in the core
  proxy = await startProxy(core.url, project);
  const profile = join(dir, "profile");
  const { stdout } = await promisify(execFile)(chrome!, [
    "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", `--user-data-dir=${profile}`, "--window-size=1500,1000",
    "--virtual-time-budget=240000", "--dump-dom", `http://127.0.0.1:${(proxy.address() as { port: number }).port}/`,
  ], { timeout: 120_000, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  const raw = /<pre id="legend-report">([\s\S]*?)<\/pre>/.exec(stdout)?.[1];
  assert.ok(raw, "the page never wrote its report");
  report = JSON.parse(raw.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&"));
});

after(() => {
  proxy?.close();
  core?.close();
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); // Chrome helpers may hold the profile folder a moment
});

const short = (text: string) => (text.length > 48 ? `${text.slice(0, 48)}...` : text);

test("the page ran without errors and recorded a run of the function", { skip }, () => {
  assert.deepEqual(report.errors, []);
  assert.ok(report.recording && report.recording.steps > 5, "no recording was played");
});

for (const layer of ["business", "requirements", "architecture", "components", "flow"]) {
  test(`${layer}: every legend entry corresponds to something drawn`, { skip }, () => {
    const { rows, colours, drawnTones } = report.layers[layer];
    const problems = [
      ...rows.flatMap((r) =>
        r.selector === null && r.why ? []
        : r.selector === null ? [`${layer}: legend entry "${short(r.text)}" has no selector (third element) and no reason (fourth element)`]
        : r.matches === 0 ? [`${layer}: legend entry "${short(r.text)}" matches nothing drawn (${r.selector})`] : []),
      ...colours.filter((c) => !drawnTones.includes(c)).map((c) => `${layer}: legend colour "${c}" is never drawn`),
    ];
    assert.deepEqual(problems, []);
  });

  test(`${layer}: everything drawn has a legend entry`, { skip }, () => {
    const { colours, drawnTones, uncovered } = report.layers[layer];
    const allowed = { ...packet, ...ALLOWED[layer] };
    const problems = [
      ...drawnTones.filter((t) => !colours.includes(t)).map((t) => `${layer}: colour "${t}" is drawn but is not in its legend`),
      ...Object.entries(uncovered).filter(([token]) => !(token in allowed)).map(([token, tag]) => `${layer}: drawn kind ".${token}" (${tag}) has no legend entry`),
      ...Object.keys(ALLOWED[layer]).filter((token) => !(token in uncovered)).map((token) => `${layer}: allowlist entry ".${token}" is not drawn any more`),
    ];
    assert.deepEqual(problems, []);
  });
}
