import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startCore } from "../src/core/server.ts";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { fixture } from "./helpers.ts";

// What the builder's process is given: the tools aidea offers it (as Claude Code lists them) and the ones pre-allowed.
let seen: { listed: { name: string; annotations?: { readOnlyHint?: boolean } }[]; allowed: string[] };
const adapter: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ permission }): AsyncGenerator<AgentEvent> {
    const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
    const rpc = (method: string) =>
      fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method, params: {} }) }).then((r) => r.json());
    seen = { listed: (await rpc("tools/list")).result.tools, allowed: permission!.allowedTools };
    yield { type: "result", text: "ok", costUsd: 0, durationMs: 0, usage: { inputTokens: 0, outputTokens: 0 } };
  },
};

let core: Awaited<ReturnType<typeof startCore>>;
before(async () => {
  core = await startCore({ port: 0, adapter });
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: fixture("shop") }) });
  await (await fetch(core.url + "/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: fixture("shop"), message: "hi" }) })).text();
});
after(() => core.close());

test("every aidea tool except the permission prompt is allowed in advance, so none asks the person in any mode", () => {
  const names = seen.listed.map((t) => t.name).filter((n) => n !== "approve");
  assert.deepEqual(seen.allowed.map((a) => a.replace("mcp__aidea__", "")).sort(), names.sort());
});

test("the tools that only read say so, because Plan mode asks for any tool that does not", () => {
  for (const name of ["read_contract", "list_proposals"]) {
    assert.equal(seen.listed.find((t) => t.name === name)?.annotations?.readOnlyHint, true, name);
  }
});
