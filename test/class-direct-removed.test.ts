import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { BUILDER_INSTRUCTIONS } from "../src/core/contract.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// Class mode, Direct mode and the decision classes are gone (decided 2026-11-03): the Builder is the builder, and the person with the Tutor is the architect. The Contract is agreed
// first and handed over; a change that is not in it reaches the person only as a Proposal, which is accepted or rejected at once. When the person does not understand something, they
// select it and ask the Tutor with the selection control.
type RunOptions = Parameters<Adapter["run"]>[0];
const launches: RunOptions[] = [];
let builderCalls: (rpc: (method: string, params: unknown, id?: number) => Promise<any>) => Promise<void> = async () => {};
const fake: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "sonnet", label: "Sonnet" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    launches.push(opts);
    if (opts.role === "extractor") return yield { type: "result", text: "", structured: { propositions: [], chains: [] }, usage: {} };
    if (opts.role === "auditor") return yield { type: "result", text: "", structured: { links: [] }, usage: {} };
    if (opts.permission) {
      const url = JSON.parse(opts.permission.mcpConfig).mcpServers.aidea.url as string;
      const rpc = async (method: string, params: unknown, id = 1) => (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) })).json()) as any;
      await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } });
      await builderCalls(rpc);
    }
    yield { type: "text", text: "done" };
  },
};

const scratch = mkdtempSync(join(tmpdir(), "aidea-no-class-"));
const cores: Awaited<ReturnType<typeof startCore>>[] = [];
after(() => { cores.forEach((c) => c.close()); rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });
let n = 0;
async function start() {
  const project = join(scratch, `p${n++}`);
  cpSync(fixture("studio"), project, { recursive: true });
  const core = await startCore({ port: 0, adapter: fake, learnerDir: mkdtempSync(join(tmpdir(), "aidea-no-class-learner-")) });
  cores.push(core);
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const id = ((await (await post("/projects", { path: project })).json()) as any).id;
  return { core, post, project: id as string };
}

test("the Builder's options have no Class or Direct setting any more, and asking for one is refused; the review question setting stays", async () => {
  const t = await start();
  const read = (await (await fetch(`${t.core.url}/agent-options?project=${encodeURIComponent(t.project)}`)).json()) as any;
  assert.equal("classMode" in read, false);
  assert.equal(typeof read.reviewQuestion, "boolean");
  assert.equal((await t.post("/agent-options", { project: t.project, classMode: "class" })).status, 400);
  assert.equal((await t.post("/agent-options", { project: t.project, reviewQuestion: false })).status, 200);
});

test("a Proposal of the Builder is pending at once, announced as a Proposal and nothing else, and can be accepted without any class", async () => {
  const t = await start();
  const node = { id: "cache-note", title: "A cache", rationale: { why: "Reads dominate.", rejected: [{ option: "None", reason: "Slow." }] } };
  builderCalls = async (rpc) => { await rpc("tools/call", { name: "propose_add_node", arguments: { layer: "business", node: { ...node, block: "key-resources", description: "x" } } }, 2); };
  const events = ((await (await t.post("/chat", { project: t.project, message: "go" })).text()).trim().split("\n").map((l) => JSON.parse(l))) as any[];
  assert.equal(events.some((e) => e.type === "decision_class"), false);
  const list = (await (await fetch(`${t.core.url}/proposals?project=${encodeURIComponent(t.project)}`)).json()) as any;
  for (const p of list.proposals) assert.equal(p.status, "pending", p.nodeId);
  builderCalls = async () => {};
});

test("the way to skip a decision class is gone", async () => {
  const t = await start();
  assert.equal((await t.post("/proposals/skip-class", { id: "prop-1", secret: "x" })).status, 404);
});

test("a class cannot be opened for a decision, and the Tutor has no tool to read or record one", async () => {
  const t = await start();
  launches.length = 0;
  const res = await t.post("/tutor/classes", { project: t.project, decision: "prop-1" });
  await res.text();
  const tutor = launches.find((l) => l.role === "tutor");
  assert.ok(tutor, "the class starts as any free class");
  assert.doesNotMatch(tutor!.message, /decision class|Blocking decision/i);
  const { TUTOR_TOOLS } = await import("../src/core/tutor.ts");
  assert.deepEqual([...TUTOR_TOOLS].map((x: any) => x.name).filter((x: string) => /_decision$/.test(x)), []);
});

test("the guide and the page no longer speak of Direct, Class or Decide for me", async () => {
  const { readFileSync } = await import("node:fs");
  const guide = readFileSync(new URL("../src/core/guide.ts", import.meta.url), "utf8");
  assert.doesNotMatch(guide, /Direct and Class|Decide for me|Blocking decision|decision class/i);
  const t = await start();
  const page = await (await fetch(t.core.url + "/")).text();
  assert.doesNotMatch(page, /"Builder works"|Decide for me|decision-class|waiting-for-class/);
});

test("the Builder is told that the Contract is what it follows and that it invents nothing: when the Contract lacks something it stops and says so", () => {
  assert.match(BUILDER_INSTRUCTIONS, /read_contract/);
  assert.match(BUILDER_INSTRUCTIONS, /do not invent|never invent|not invent/i);
  assert.match(BUILDER_INSTRUCTIONS, /stop/i);
  assert.match(BUILDER_INSTRUCTIONS, /say in the chat/i);
  assert.doesNotMatch(BUILDER_INSTRUCTIONS, /Proposal/, "the Builder makes no Proposals on the layers (roles-and-contract 11)");
});
