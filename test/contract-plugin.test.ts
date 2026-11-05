import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { runPluginTeachTool } from "../src/core/plugins/teach.ts";
import { startCore } from "../src/core/server.ts";

// roles-and-contract 04: the Contract and the Differences are a plugin that ships with aidea. It offers the Builders `read_contract`, the Tutor a view and checks, and a lesson.
const scratch = mkdtempSync(join(tmpdir(), "aidea-contract-plugin-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

type Seen = { tools: { name: string; annotations?: { readOnlyHint?: boolean } }[]; read: string; instructions: string };
let seen: Seen;
const asBuilder: Adapter = {
  options: { modes: [], models: [] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    const url = JSON.parse(opts.permission!.mcpConfig).mcpServers.aidea.url as string;
    let id = 1;
    const rpc = (method: string, params: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) }).then((r) => r.json()) as Promise<any>;
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } });
    const tools = (await rpc("tools/list", {})).result.tools;
    const r = (await rpc("tools/call", { name: "read_contract" })).result;
    seen = { tools, read: r?.content?.[0]?.text ?? "", instructions: opts.instructions ?? "" };
    yield { type: "result", text: "", usage: {} };
  },
};

let n = 0;
async function start() {
  const core = await startCore({ port: 0, adapter: asBuilder, pluginsDir: join(scratch, `s${n++}`) });
  const post = async (path: string, body: unknown) => (await fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json() as Promise<any>;
  const dir = join(scratch, `proj${n++}`);
  mkdirSync(join(dir, ".aidea"), { recursive: true });
  writeFileSync(join(dir, "a.py"), "def a():\n    return 1\n");
  writeFileSync(join(dir, ".aidea", "business.json"), JSON.stringify({ nodes: [{ id: "cs-owners", title: "Shop owners", block: "customer segments", rationale: { why: "Because.", rejected: [{ option: "Else", reason: "Worse." }] } }] }));
  return { core, post, dir };
}

test("the Contract ships as a plugin that is on by default and offers read_contract to the Builder only", async () => {
  const { core, post, dir } = await start();
  try {
    const { plugins } = (await (await fetch(core.url + "/plugins")).json()) as any;
    const p = plugins.find((x: any) => x.id === "contract");
    assert.deepEqual([p?.state, p?.builtin, p?.required], ["active", true, false]);
    const id = (await post("/projects", { path: dir })).id;
    await (await fetch(core.url + "/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: id, message: "build it" }) })).text();
    const tool = seen.tools.find((t) => t.name === "read_contract");
    assert.equal(tool?.annotations?.readOnlyHint, true);
    assert.equal(JSON.parse(seen.read).business["customer segments"][0].id, "cs-owners", "the answer is the Contract itself, not wrapped");
    assert.match(seen.instructions, /read_contract/);
    const ok = await fetch(`${core.url}/contract?project=${encodeURIComponent(id)}`);
    assert.equal(ok.status, 200);
  } finally { core.close(); }
});

test("with the plugin off there is no Contract, no Differences and nothing conditions the Builder", async () => {
  const { core, post, dir } = await start();
  try {
    assert.equal((await post("/plugins/disable", { id: "contract" })).status, "applied");
    const id = (await post("/projects", { path: dir })).id;
    assert.equal((await fetch(`${core.url}/contract?project=${encodeURIComponent(id)}`)).status, 404);
    assert.equal((await fetch(`${core.url}/drift?project=${encodeURIComponent(id)}`)).status, 404);
    await (await fetch(core.url + "/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: id, message: "build it" }) })).text();
    assert.ok(!seen.tools.some((t) => t.name === "read_contract"));
    assert.doesNotMatch(seen.instructions, /Contract|read_contract/);
  } finally { core.close(); }
});

test("the Tutor reads the Contract through the plugin's view and checks", async () => {
  const { core, post, dir } = await start();
  try {
    const id = (await post("/projects", { path: dir })).id;
    const view: any = JSON.parse((await runPluginTeachTool("read_plugin_view", { id: "contract" }, core as any, {}, { project: id }))!.text);
    assert.equal(view.view.agreed.length, 6);
    assert.ok(view.view.agreed.some((c: any) => c.id === "customer-segments" && c.met));
    const yes: any = JSON.parse((await runPluginTeachTool("check_plugin", { id: "contract", name: "check-met", args: { id: "customer-segments" } }, core as any, {}, { project: id }))!.text);
    assert.equal(yes.result.ok, true);
    const no: any = JSON.parse((await runPluginTeachTool("check_plugin", { id: "contract", name: "check-met", args: { id: "containers" } }, core as any, {}, { project: id }))!.text);
    assert.equal(no.result.ok, false);
    const guide: any = await (await fetch(core.url + "/guide")).json();
    assert.ok(guide.plugins.some((p: any) => p.id === "contract"), "its lesson reaches the tour");
  } finally { core.close(); }
});
