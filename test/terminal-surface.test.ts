import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { scanPlugin } from "../src/core/plugins/scan.ts";
import { runPluginTeachTool } from "../src/core/plugins/teach.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// plugin-teaching 07: the Terminal plugin declares a teaching surface: a view of its tabs and a check that a program wrote something. The Tutor asks with the Project of its session.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(join(tmpdir(), "aidea-terminal-surface-"));
const cores: { close(): void }[] = [];
after(() => { for (const c of cores) c.close(); rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); });
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const seen: { view?: any; check?: any; missing?: any } = {};
const tutor: Adapter = {
  options: { modes: [], models: [] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    if (opts.role !== "tutor") return;
    const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
    const call = async (name: string, args: unknown) => JSON.parse((await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) })).json()).result.content[0].text);
    seen.view = await call("read_plugin_view", { id: "terminal" });
    seen.check = await call("check_plugin", { id: "terminal", name: "program-wrote", args: { program: "hello" } });
    seen.missing = await call("check_plugin", { id: "terminal", name: "program-wrote", args: { program: "ghost" } });
    yield { type: "text", text: "ok" };
  },
};

async function boot() {
  const project = join(scratch, "project");
  cpSync(fixture("shop"), project, { recursive: true });
  mkdirSync(join(project, ".aidea"), { recursive: true });
  writeFileSync(join(project, ".aidea", "run.json"), JSON.stringify({ parts: [{ name: "hello", command: `node -e "console.log('hello from the part')"` }] }));
  const store = join(scratch, "store");
  mkdirSync(store, { recursive: true });
  const core = await startCore({ port: 0, adapter: tutor, pluginsDir: store, learnerDir: join(scratch, "learner"), recentsFile: join(scratch, "r.json"), preferencesFile: join(scratch, "p.json") });
  cores.push(core);
  const id = ((await (await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) })).json()) as any).id;
  const call = async (name: string, body: object = {}) => (await (await fetch(`${core.url}/plugins/run/call/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: id, ...body }) })).json()) as any;
  return { core, id, call };
}

test("the Terminal plugin declares a surface and the scan shows no surface or lesson warning for it", () => {
  const report = scanPlugin(join(root, "src", "plugins", "terminal"));
  assert.equal(report.blocking, 0);
  assert.equal(report.manifest?.teach?.view, "state");
  assert.ok(report.manifest!.teach!.checks.some((c) => c.name === "program-wrote"));
  assert.deepEqual(report.findings.filter((f) => /surface|lesson/.test(f.id)), []);
});

test("the Tutor reads the tabs of the Terminal and runs its check, with the Project of its own session", async () => {
  const t = await boot();
  const empty = JSON.parse((await runPluginTeachTool("read_plugin_view", { id: "terminal" }, t.core as any, {}, { project: t.id }))!.text);
  assert.deepEqual(empty.view.tabs, [], "nothing started yet: no tab");
  await t.call("accept");
  assert.equal((await t.call("play")).started, true);
  for (let i = 0; i < 100 && !(await t.call("output")).parts?.[0]?.lines?.length; i++) await wait(50);
  const res = await fetch(t.core.url + "/tutor/classes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: t.id, message: "What did my program print?" }) });
  await res.text();
  assert.equal(seen.view.untrusted, true);
  assert.equal(seen.view.view.tabs[0].name, "hello");
  assert.match(seen.view.view.tabs[0].lastLines.join("\n"), /hello from the part/);
  assert.equal(seen.check.result.ok, true);
  assert.equal(seen.missing.result.ok, false);
  assert.match(seen.missing.result.reason, /no tab/i);
  await t.call("stopAll");
});
