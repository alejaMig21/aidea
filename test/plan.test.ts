import { test, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { TUTOR_INSTRUCTIONS } from "../src/core/tutor.ts";
import { fixture } from "./helpers.ts";

type Call = (name: string, args: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;

// A stand-in for Claude Code: the Teacher is a script over the core's MCP tools.
let teacher: (call: Call) => AsyncGenerator<AgentEvent> = async function* () {};
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    if (opts.role !== "tutor") return;
    const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
    const call: Call = async (name, args) =>
      (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) })).json()).result;
    yield* teacher(call);
  },
};

const project = fixture("shop");
const cores: Awaited<ReturnType<typeof startCore>>[] = [];
async function newCore(dir = mkdtempSync(join(tmpdir(), "aidea-plan-"))) {
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: dir });
  cores.push(core);
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
  const post = (path: string, body: unknown = {}) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const get = async (path: string) => (await fetch(core.url + path)).json() as Promise<any>;
  const runClass = async (reply: (q: any) => Record<string, unknown> = () => ({ text: "a guess" })) => {
    const res = await post("/tutor/classes", { project });
    const out: any[] = [];
    let buf = "";
    for await (const chunk of res.body as any) {
      buf += Buffer.from(chunk).toString();
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const line of lines) {
        if (!line) continue;
        const e = JSON.parse(line);
        out.push(e);
        if (e.type === "tutor_question") await post("/tutor/answer", { id: e.id, secret: e.secret, ...reply(e) });
      }
    }
    return out;
  };
  const plan = () => get(`/tutor/plan?project=${encodeURIComponent(project)}`);
  return { core, dir, post, get, runClass, plan };
}
after(() => cores.forEach((c) => c.close()));

const text = (r: { content: { text: string }[] }) => r.content[0].text;
const json = (r: { content: { text: string }[] }) => JSON.parse(text(r));
const PLAN = {
  concepts: [
    { name: "Queue", dependsOn: [] },
    { name: "Worker", dependsOn: ["Queue"] },
    { name: "Retry policy", dependsOn: ["Worker"], layer: "architecture" },
  ],
  decisions: [{ layer: "architecture", question: "Where does the queue live?" }],
};
const choice = (stepId: string) => ({ stepId, kind: "choice", prompt: "Which one stores the data?", options: ["Queue", "Database", "Cache"], correct: "Database" });

test("the Teacher sets a plan with dependencies; it is stored, returned to the Teacher and shown to the person", async () => {
  const t = await newCore();
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    seen.before = json(await call("get_plan", {}));
    seen.set = await call("set_plan", PLAN);
    seen.after = json(await call("get_plan", {}));
    yield { type: "text", text: "done" };
  };
  const events = await t.runClass();
  assert.equal(seen.before.plan, null);
  assert.equal(seen.set.isError, undefined);
  assert.deepEqual(seen.after.plan.concepts.map((c: any) => c.name), ["Queue", "Worker", "Retry policy"]);
  assert.deepEqual(seen.after.plan.concepts[1].dependsOn, ["Queue"]);
  assert.equal(events.find((e) => e.type === "tutor_plan").plan.decisions[0].question, "Where does the queue live?");
  const shown = await t.plan();
  assert.equal(shown.plan.concepts.length, 3);
  assert.deepEqual(shown.covered, []);
});

test("a plan with a cycle, an unknown dependency or a malformed shape is rejected with words the model can act on", async () => {
  const t = await newCore();
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    seen.cycle = await call("set_plan", { concepts: [{ name: "A", dependsOn: ["B"] }, { name: "B", dependsOn: ["A"] }] });
    seen.self = await call("set_plan", { concepts: [{ name: "A", dependsOn: ["A"] }] });
    seen.unknown = await call("set_plan", { concepts: [{ name: "A", dependsOn: ["Zzz"] }] });
    seen.twice = await call("set_plan", { concepts: [{ name: "A", dependsOn: [] }, { name: "a", dependsOn: [] }] });
    seen.empty = await call("set_plan", { concepts: [] });
    seen.badLayer = await call("set_plan", { concepts: [{ name: "A", dependsOn: [], layer: "nope" }] });
    seen.extra = await call("set_plan", { concepts: [{ name: "A", dependsOn: [], done: true }] });
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  for (const k of Object.keys(seen)) assert.equal(seen[k].isError, true, k);
  assert.match(text(seen.cycle), /cycle.*A.*B/i);
  assert.match(text(seen.unknown), /Zzz/);
  assert.match(text(seen.empty), /concepts/);
  assert.match(text(seen.badLayer), /layer/);
  assert.match(text(seen.extra), /done/);
  assert.equal((await t.plan()).plan, null);
});

test("with a plan, a step about an item outside it is rejected, so its questions never reach the person", async () => {
  const t = await newCore();
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    await call("set_plan", PLAN);
    seen.outside = await call("begin_step", { stepId: "s1", title: "Sharding", item: "Sharding" });
    seen.noItem = await call("begin_step", { stepId: "s1", title: "Anything" });
    seen.inside = await call("begin_step", { stepId: "s1", title: "What a queue is for", item: "queue" }); // matched ignoring case
    seen.predict = await call("predict", { stepId: "s1", prompt: "What is a queue for?" });
    yield { type: "text", text: "done" };
  };
  const events = await t.runClass();
  assert.equal(seen.outside.isError, true);
  assert.match(text(seen.outside), /Sharding.*not in the Plan.*Queue, Worker, Retry policy/s);
  assert.equal(seen.noItem.isError, true);
  assert.match(text(seen.noItem), /item/);
  assert.equal(seen.inside.isError, undefined);
  assert.equal(events.filter((e) => e.type === "tutor_question").length, 1);
});

test("without a plan, steps need no item (a plan is never a gate to the first class)", async () => {
  const t = await newCore();
  let r: any;
  teacher = async function* (call) {
    r = await call("begin_step", { stepId: "s1", title: "Anything" });
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  assert.equal(r.isError, undefined);
});

test("a revised plan replaces the old one and keeps what is still valid", async () => {
  const t = await newCore();
  let after: any;
  teacher = async function* (call) {
    await call("set_plan", PLAN);
    await call("set_plan", { concepts: [{ name: "Queue", dependsOn: [] }, { name: "Worker", dependsOn: ["Queue"] }, { name: "Dead letter", dependsOn: ["Worker"] }], decisions: [] });
    after = json(await call("get_plan", {})).plan;
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  assert.deepEqual(after.concepts.map((c: any) => c.name), ["Queue", "Worker", "Dead letter"]);
  assert.deepEqual(after.decisions, []);
});

test("what is covered is derived from the Evidence and the Learner graph, never stored", async () => {
  const t = await newCore();
  teacher = async function* (call) {
    await call("set_plan", PLAN);
    await call("begin_step", { stepId: "s1", title: "Queue", item: "Queue" });
    await call("predict", { stepId: "s1", prompt: "What is a queue for?" });
    await call("explain", { stepId: "s1", text: "A queue holds work." });
    await call("ask", choice("s1")); // answered wrong first
    await call("explain", { stepId: "s1", text: "Again, from a new angle." });
    await call("ask", choice("s1"));
    yield { type: "text", text: "done" };
  };
  let n = 0;
  await t.runClass((q) => (q.kind === "text" ? { text: "to hold work" } : { option: n++ === 0 ? 0 : 1, confidence: 50 }));
  assert.deepEqual((await t.plan()).covered, ["Queue"]);
  assert.doesNotMatch(readFileSync(join(t.dir, "plans.jsonl"), "utf8"), /covered/);
});

test("a plan concept already on the Learner graph counts as covered", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-plan-"));
  writeFileSync(join(dir, "propositions.jsonl"), JSON.stringify({ op: "put", proposition: { id: "worker", name: "Worker", statement: "A worker takes jobs.", aliases: [], provenance: [{ classId: "c1", message: 0 }] } }) + "\n");
  const t = await newCore(dir);
  teacher = async function* (call) {
    await call("set_plan", PLAN);
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  assert.deepEqual((await t.plan()).covered, ["Worker"]);
});

test("the plan survives a core restart and lives outside the Project folder", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-plan-"));
  const first = await newCore(dir);
  teacher = async function* (call) {
    await call("set_plan", PLAN);
    yield { type: "text", text: "done" };
  };
  await first.runClass();
  await first.core.close();
  const again = await newCore(dir);
  assert.equal((await again.plan()).plan.concepts.length, 3);
  assert.ok(existsSync(join(dir, "plans.jsonl")));
  assert.ok(!readdirSync(project, { recursive: true }).some((f) => /plan/i.test(String(f))), "no plan file inside the Project");
});

test("an unknown Project has no plan, and the instructions teach the plan within the size limit", async () => {
  const t = await newCore();
  assert.equal((await fetch(t.core.url + "/tutor/plan?project=nope")).status, 400);
  assert.match(TUTOR_INSTRUCTIONS, /set_plan/);
  assert.ok(TUTOR_INSTRUCTIONS.length < 4000, `${TUTOR_INSTRUCTIONS.length} characters`);
});
