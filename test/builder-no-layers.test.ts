import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";

// roles-and-contract 11: the Builder works from the Contract and does not change it. It has no tool that proposes changes to the layers, and a call to one of the old ones is answered, not obeyed.
const scratch = mkdtempSync(join(tmpdir(), "aidea-builder-no-layers-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

const OLD = ["propose_add_node", "propose_update_node", "propose_remove_node", "propose_pattern_group"];
let seen: { tools: string[]; answers: { isError: boolean; text: string }[]; allowed: string[]; instructions: string };
const asBuilder: Adapter = {
  options: { modes: [], models: [] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    const url = JSON.parse(opts.permission!.mcpConfig).mcpServers.aidea.url as string;
    let id = 1;
    const rpc = (method: string, params: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) }).then((r) => r.json()) as Promise<any>;
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } });
    const tools = ((await rpc("tools/list", {})).result.tools as { name: string }[]).map((t) => t.name);
    const node = { id: "x", title: "X", technology: "T", rationale: { why: "w", rejected: [] } };
    const calls = [{ layer: "architecture", node }, { layer: "architecture", id: "x", changes: { title: "Y" } }, { layer: "architecture", id: "x" }, { group: { id: "g", name: "G", kind: "layered", roles: [] } }];
    const answers: { isError: boolean; text: string }[] = [];
    for (const [i, name] of OLD.entries()) {
      const r = (await rpc("tools/call", { name, arguments: calls[i] })).result;
      answers.push({ isError: r?.isError === true, text: r?.content?.[0]?.text ?? "" });
    }
    seen = { tools, answers, allowed: opts.permission!.allowedTools ?? [], instructions: opts.instructions ?? "" };
    yield { type: "result", text: "", usage: {} };
  },
};

test("the Builder has no tool to propose changes to the layers, and a call to an old one changes nothing and says why", async () => {
  const core = await startCore({ port: 0, adapter: asBuilder, pluginsDir: join(scratch, "store") });
  try {
    const dir = join(scratch, "project");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "a.py"), "def a():\n    return 1\n");
    const opened = (await (await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: dir }) })).json()) as any;
    await (await fetch(core.url + "/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: opened.id, message: "build it" }) })).text();
    for (const name of OLD) {
      assert.ok(!seen.tools.includes(name), `${name} is not offered`);
      assert.ok(!seen.allowed.includes(`mcp__aidea__${name}`), `${name} is not allowed in advance`);
    }
    assert.ok(seen.tools.includes("read_contract"), "it still reads the Contract");
    for (const a of seen.answers) {
      assert.equal(a.isError, true);
      assert.match(a.text, /does not change the layers/);
      assert.match(a.text, /say in the chat/);
    }
    assert.equal(core.proposals.size, 0, "no Proposal was made");
    assert.match(seen.instructions, /stop/i);
    assert.doesNotMatch(seen.instructions, /Proposal/);
  } finally { core.close(); }
});
