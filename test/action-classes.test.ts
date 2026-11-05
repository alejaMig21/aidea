import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { ACTION_CLASSES, classOfTool } from "../src/core/plugins/actions.ts";
import { readManifest } from "../src/core/plugins/manifest.ts";
import { scanPlugin } from "../src/core/plugins/scan.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// plugin-policies 01: a closed list of classes of action and their scope; plugins declare the classes they use and the scan compares; the kernel tags every action it mediates.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(join(tmpdir(), "aidea-action-classes-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }));

test("the list of classes is closed, and docs/plugin-api.md names exactly those", () => {
  const ids = ACTION_CLASSES.map((c) => c.id);
  assert.deepEqual(ids, ["writes-project", "writes-outside", "runs-program", "uses-network", "reads-secrets"]);
  const docs = readFileSync(join(root, "docs", "plugin-api.md"), "utf8");
  for (const id of ids) assert.ok(docs.includes("`" + id + "`"), id);
  const section = /### Classes of action[\s\S]*?(?=\n###? )/.exec(docs)?.[0] ?? "";
  assert.deepEqual([...new Set([...section.matchAll(/`((?:writes|runs|uses|reads)-[a-z]+)`/g)].map((m) => m[1]))].sort(), [...ids].sort());
});

let n = 0;
function plugin(main: string, extra: Record<string, unknown> = {}) {
  const dir = join(scratch, `p${n++}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id: `fixture.p${n}`, version: "1.0.0", title: "T", description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...extra }));
  writeFileSync(join(dir, "main.js"), main);
  return dir;
}
const problems = (extra: unknown) => { const r = readManifest(plugin("export function activate() {}", { actions: extra })); return "problems" in r ? r.problems.join("; ") : ""; };

test("the manifest takes a list of known classes and refuses anything else, naming the field", () => {
  assert.equal(problems(["runs-program", "uses-network"]), "");
  assert.match(problems(["runs-program", "does-magic"]), /"actions".*does-magic/);
  assert.match(problems("runs-program"), /"actions".*list/);
});

test("a plugin that uses a class it did not declare is a blocking finding, and one that declares a class it does not use is a warning", () => {
  const code = `import { execFile } from "node:child_process";\nimport { writeFileSync } from "node:fs";\nexport function activate() { execFile("echo"); writeFileSync("x", "y"); fetch("http://127.0.0.1:1"); }`;
  const caps = { capabilities: ["processes", "files", "network"] };
  const missing = scanPlugin(plugin(code, { ...caps, actions: ["runs-program"] }));
  const undeclared = missing.findings.filter((f) => f.id === "undeclared-action");
  assert.deepEqual(undeclared.map((f) => f.severity), ["block", "block"]);
  assert.ok(undeclared.some((f) => /uses-network/.test(f.message)) && undeclared.some((f) => /writes/.test(f.message)));
  const full = scanPlugin(plugin(code, { ...caps, actions: ["runs-program", "uses-network", "writes-project"] }));
  assert.deepEqual(full.findings.filter((f) => /-action$/.test(f.id)), []);
  assert.equal(scanPlugin(plugin(code, { ...caps, actions: ["runs-program", "uses-network", "writes-outside"] })).findings.filter((f) => f.id === "undeclared-action").length, 0, "either write class covers a write");
  const extra = scanPlugin(plugin(`export function activate() {}`, { actions: ["reads-secrets"] }));
  assert.deepEqual(extra.findings.filter((f) => f.id === "unused-action").map((f) => f.severity), ["warn"]);
  assert.equal(extra.blocking, 0);
});

test("a plugin that declares no actions is judged by its capabilities as before", () => {
  const report = scanPlugin(plugin(`import { execFile } from "node:child_process";\nexport function activate() { execFile("echo"); }`, { capabilities: ["processes"] }));
  assert.deepEqual(report.findings.filter((f) => /-action$/.test(f.id)), []);
  assert.equal(report.blocking, 0);
});

test("a tool of the Builder is classified by what it does and where: inside the Project, outside it, a program, the network", () => {
  const project = join(scratch, "a project");
  const inside = (t: string, input: Record<string, unknown>) => classOfTool(t, input, project);
  assert.deepEqual(inside("Write", { file_path: join(project, "src", "a.py") }), { class: "writes-project", scope: { path: "src/a.py" } });
  assert.deepEqual(inside("Edit", { file_path: "src/a.py" }), { class: "writes-project", scope: { path: "src/a.py" } }, "a relative path is inside the Project");
  assert.deepEqual(inside("MultiEdit", { file_path: join(scratch, "elsewhere.txt") }), { class: "writes-outside", scope: { path: join(scratch, "elsewhere.txt") } });
  assert.deepEqual(inside("Write", { file_path: "../other/x" }), { class: "writes-outside", scope: { path: "../other/x" } });
  assert.deepEqual(inside("Bash", { command: "ls" }), { class: "runs-program", scope: {} });
  assert.deepEqual(inside("WebFetch", { url: "https://example.com" }), { class: "uses-network", scope: {} });
  assert.deepEqual(inside("Read", { file_path: "x" }), {}, "reading is no class");
  assert.deepEqual(inside("mcp__aidea__list_proposals", {}), {}, "a tool aidea offers is no class of its own");
});

test("an action the kernel mediates reaches the guard rules with its class, its scope and who did it", async () => {
  const seen: any[] = [];
  (globalThis as any).__actionsSeen = seen;
  const store = join(scratch, "store");
  const guard = join(store, "watcher");
  mkdirSync(guard, { recursive: true });
  writeFileSync(join(guard, "aidea-plugin.json"), JSON.stringify({ id: "watcher", version: "1.0.0", title: "Watcher", description: "Records the actions.", publisher: "tests", api: "0.1", main: "main.js" }));
  writeFileSync(join(guard, "main.js"), `export function activate(ctx) { ctx.guards.add((a) => { globalThis.__actionsSeen.push(a); return a.kind === "tool" ? { decision: "deny", reason: "recorded" } : undefined; }); ctx.agents.tools.add({ name: "tidy", description: "Tidies.", class: "writes-project", inputSchema: { type: "object", properties: {} }, run: () => ({ ok: true }) }); }`);
  const project = join(scratch, "project");
  cpSync(fixture("shop"), project, { recursive: true });
  const adapter: Adapter = {
    options: { modes: [], models: [] },
    run: async function* ({ permission }): AsyncGenerator<AgentEvent> {
      const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
      const rpc = (method: string, params: unknown, id: number) => fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
      await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } }, 1);
      // The rule denies every tool, so no card waits for the person: what it recorded is what reached it.
      await rpc("tools/call", { name: "watcher_tidy", arguments: {} }, 2);
      const approve = (tool_name: string, input: object, id: number) => rpc("tools/call", { name: "approve", arguments: { tool_name, input } }, id);
      await approve("Write", { file_path: join(project, "src", "orders.py") }, 3);
      await approve("Edit", { file_path: join(dirname(project), "outside.txt") }, 4);
      await approve("Bash", { command: "ls" }, 5);
      await approve("WebFetch", { url: "https://example.com" }, 6);
      yield { type: "text", text: "ok" };
    },
  };
  const dir = mkdtempSync(join(scratch, "c"));
  const core = await startCore({ port: 0, adapter, learnerDir: dir, pluginsDir: store, builtinPluginsDir: false, preferencesFile: join(dir, "p.json"), recentsFile: join(dir, "r.json") });
  try {
    const post = (path: string, b: unknown = {}) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    await post("/projects", { path: project });
    await (await post("/chat", { project, message: "go" })).text();
    const tool = seen.find((a) => a.kind === "agent-tool");
    assert.ok(tool, JSON.stringify(seen));
    assert.deepEqual([tool.class, tool.by], ["writes-project", { role: "plugin", plugin: "watcher" }]);
    const asked = seen.filter((a) => a.kind === "tool");
    assert.deepEqual(asked.map((a) => [a.tool, a.class]), [["Write", "writes-project"], ["Edit", "writes-outside"], ["Bash", "runs-program"], ["WebFetch", "uses-network"]]);
    assert.deepEqual(asked[0].scope, { path: "src/orders.py" });
    assert.ok(asked.every((a) => a.by.role === "builder" && typeof a.project === "string"));
  } finally { await core.plugins.deactivate("watcher"); core.close(); }
});
