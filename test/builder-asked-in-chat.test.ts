import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { PLUGIN_READ_TOOLS, READ_TOOLS } from "../src/core/tutor-reads.ts";
import { TUTOR_TOOLS } from "../src/core/tutor.ts";
import { fixture } from "./helpers.ts";

// roles-and-contract 01: the person asks a Builder for work by writing in its chat; nothing else starts one, and what they write never widens what the Builder may do.
const scratch = mkdtempSync(join(tmpdir(), "aidea-builder-chat-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }));
const project = fixture("shop");

const runs: { role: string; message: string; mode?: string }[] = [];
const agent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }, { id: "plan", label: "Plan", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    runs.push({ role: opts.role ?? "builder", message: opts.message, mode: opts.mode });
    if (opts.role === "tutor") {
      const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
      const call = (name: string, args: unknown) => fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) });
      await call("finish_class", { summary: "x" });
    }
    yield { type: "text", text: "ok" };
  },
};
async function start() {
  const dir = mkdtempSync(join(scratch, "c"));
  const core = await startCore({ port: 0, adapter: agent, learnerDir: dir, preferencesFile: join(dir, "p.json"), recentsFile: join(dir, "r.json") });
  const post = (path: string, b: unknown = {}) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  await post("/projects", { path: project });
  return { core, post, options: async () => JSON.stringify(await (await fetch(core.url + `/agent-options?project=${encodeURIComponent(project)}`)).json()) };
}

test("no tool of the Tutor can send a message to a Builder or start one", () => {
  const names = [...TUTOR_TOOLS, ...READ_TOOLS, ...PLUGIN_READ_TOOLS].map((t: any) => t.name);
  assert.deepEqual(names.filter((n) => /send|start|assign|builder|delegate|hand_?over|dispatch/i.test(n)), []);
});

test("a Tutor session never runs a Builder: it runs only the Tutor and the learner roles", async () => {
  const t = await start();
  try {
    runs.length = 0;
    await (await t.post("/tutor/classes", { project, message: "Teach me how to ask a Builder for work" })).text();
    assert.ok(runs.some((r) => r.role === "tutor"));
    assert.deepEqual(runs.filter((r) => r.role === "builder"), []);
  } finally { t.core.close(); }
});

test("the person's message in the Builder's chat is the only way a Builder starts: it arrives as written, and it does not change the Builder's permission mode or model", async () => {
  const t = await start();
  try {
    await t.post("/agent-options", { project, mode: "plan" });
    const before = await t.options();
    runs.length = 0;
    const message = "Read the Contract and start with the first task, only in the orders folder.";
    await (await t.post("/chat", { project, message })).text();
    const mine = runs.filter((r) => r.role === "builder");
    assert.equal(mine.length, 1);
    assert.equal(mine[0].message, message, "nothing is added to what the person wrote");
    assert.equal(mine[0].mode, "plan", "the Builder keeps the mode the person chose");
    assert.equal(await t.options(), before, "writing a message changes no setting");
  } finally { t.core.close(); }
});
