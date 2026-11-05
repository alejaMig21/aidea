import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// tutor-rewrite 03: the Plan is a map the person sees: no step begins before they say go ahead; a revised Plan keeps the ids of what stays and says what changed.
type RunOptions = Parameters<Adapter["run"]>[0];
type Call = (name: string, args: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;

let tutor: (call: Call, opts: RunOptions) => AsyncGenerator<AgentEvent> = async function* () {};
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    if (opts.role !== "tutor") return;
    const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
    const rpc = async (method: string, params: unknown = {}) =>
      (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method, params }) })).json()).result;
    yield* tutor((name, args) => rpc("tools/call", { name, arguments: args }), opts);
  },
};

const project = fixture("shop");
const cores: Awaited<ReturnType<typeof startCore>>[] = [];
async function newCore(dir = mkdtempSync(join(tmpdir(), "aidea-plan-go-")), body: Record<string, unknown> = { message: "Teach me the shop" }) {
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: dir });
  cores.push(core);
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
  const post = (path: string, b: unknown = {}) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  // Runs a session, answering each question with `reply(question)`.
  const session = async (reply: (q: any) => Record<string, unknown> = (q) => (q.phase === "plan" ? { option: 0 } : q.kind === "choice" ? { option: 0, confidence: 90 } : { text: "x" }), start = body) => {
    const res = await post("/tutor/classes", { project, ...start });
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
  return { core, dir, post, session };
}
after(() => cores.forEach((c) => c.close()));

const text = (r: { content: { text: string }[] }) => r.content[0].text;
const PLAN = { concepts: [{ name: "container", dependsOn: [] }, { name: "relationship", dependsOn: ["container"] }] };
const step = (id: string, item: string) => ({ stepId: id, title: `About ${item}`, item });

test("no step begins before the person says to go ahead; after they do, it begins", async () => {
  const t = await newCore();
  const seen: any = {};
  tutor = async function* (call) {
    await call("set_plan", PLAN);
    seen.before = await call("begin_step", step("s1", "container"));
    seen.go = await call("plan_ahead", { summary: "We will start with containers, then how they relate." });
    seen.after = await call("begin_step", step("s1", "container"));
    yield { type: "text", text: "done" };
  };
  const events = await t.session();
  assert.equal(seen.before.isError, true);
  assert.match(text(seen.before), /go-ahead|plan_ahead/i);
  assert.equal(seen.go.isError, undefined, text(seen.go));
  assert.equal(JSON.parse(text(seen.go)).approved, true);
  assert.equal(seen.after.isError, undefined, text(seen.after));
  const card = events.find((e) => e.type === "tutor_question" && e.phase === "plan");
  assert.ok(card, "the person was asked");
  assert.deepEqual(card.options, ["Go ahead", "Change the Plan first"]);
  assert.match(card.prompt, /containers/);
});

test("'Change the Plan first' keeps the gate closed, hands the person's words to the Tutor, and a revised Plan needs a new go-ahead", async () => {
  const t = await newCore();
  const seen: any = {};
  let asked = 0;
  tutor = async function* (call) {
    await call("set_plan", PLAN);
    seen.change = JSON.parse(text(await call("plan_ahead", { summary: "First plan." })));
    seen.gate = await call("begin_step", step("s1", "container"));
    await call("set_plan", { concepts: [...PLAN.concepts, { name: "boundary", dependsOn: ["relationship"] }] });
    seen.gate2 = await call("begin_step", step("s1", "container"));
    seen.go = JSON.parse(text(await call("plan_ahead", { summary: "Second plan, with boundaries." })));
    seen.open = await call("begin_step", step("s1", "container"));
    yield { type: "text", text: "done" };
  };
  await t.session((q) => (++asked === 1 ? { option: 1, thought: "Add boundaries too" } : { option: 0 }));
  assert.equal(seen.change.approved, false);
  assert.match(seen.change.change, /boundaries/);
  assert.equal(seen.gate.isError, true);
  assert.equal(seen.gate2.isError, true);
  assert.equal(seen.go.approved, true);
  assert.equal(seen.open.isError, undefined);
});

test("a revised Plan keeps the ids of the items that stay, gives new ones a fresh id, and says what changed", async () => {
  const t = await newCore();
  const seen: any = {};
  tutor = async function* (call) {
    seen.first = JSON.parse(text(await call("set_plan", PLAN)));
    seen.second = JSON.parse(text(await call("set_plan", { concepts: [{ name: "Relationship", dependsOn: [] }, { name: "boundary", dependsOn: ["Relationship"] }] })));
    seen.plan = JSON.parse(text(await call("get_plan", {}))).plan;
    yield { type: "text", text: "done" };
  };
  const events = await t.session();
  const ids = (p: any) => Object.fromEntries(p.concepts.map((c: any) => [c.name.toLowerCase(), c.id]));
  const first = ids(seen.first.plan), now = ids(seen.plan);
  assert.ok(first.container && first.relationship && first.container !== first.relationship);
  assert.equal(now.relationship, first.relationship, "the item that stays keeps its id");
  assert.ok(now.boundary && now.boundary !== first.container && now.boundary !== first.relationship, "a new item gets a fresh id");
  assert.deepEqual(seen.second.changes, { added: ["boundary"], removed: ["container"], kept: ["Relationship"] });
  const announced = events.filter((e) => e.type === "tutor_plan").at(-1);
  assert.deepEqual(announced.changes.added, ["boundary"]);
});

test("a stored Plan that was approved needs no new go-ahead in a later session; one that was not, does", async () => {
  const first = await newCore();
  tutor = async function* (call) {
    await call("set_plan", PLAN);
    await call("plan_ahead", { summary: "Plan." });
    yield { type: "text", text: "done" };
  };
  await first.session();
  const later = await newCore(first.dir);
  const seen: any = {};
  tutor = async function* (call) {
    seen.approved = await call("begin_step", step("s1", "container"));
    await call("set_plan", { concepts: [{ name: "container", dependsOn: [] }, { name: "queue", dependsOn: ["container"] }] });
    seen.changed = await call("begin_step", step("s2", "container"));
    yield { type: "text", text: "done" };
  };
  await later.session();
  assert.equal(seen.approved.isError, undefined, text(seen.approved));
  assert.equal(seen.changed.isError, true, "a different Plan is a new Plan");
});

test("the same Plan sent again keeps its go-ahead; plan_ahead needs a Plan and no open step", async () => {
  const t = await newCore();
  const seen: any = {};
  tutor = async function* (call) {
    seen.noPlan = await call("plan_ahead", { summary: "x" });
    await call("set_plan", PLAN);
    await call("plan_ahead", { summary: "Plan." });
    await call("set_plan", PLAN);
    seen.again = await call("begin_step", step("s1", "container"));
    seen.open = await call("plan_ahead", { summary: "again" });
    seen.noSummary = await call("plan_ahead", {});
    yield { type: "text", text: "done" };
  };
  await t.session();
  assert.equal(seen.noPlan.isError, true);
  assert.match(text(seen.noPlan), /set_plan/);
  assert.equal(seen.again.isError, undefined, text(seen.again));
  assert.equal(seen.open.isError, true);
  assert.match(text(seen.open), /open/i);
  assert.equal(seen.noSummary.isError, true);
});

test("the class about aidea itself has no Plan, so nothing waits for a go-ahead", async () => {
  const t = await newCore(undefined, { guide: true });
  const seen: any = {};
  tutor = async function* (call) {
    seen.step = await call("begin_step", { stepId: "g1", title: "The canvas" });
    yield { type: "text", text: "done" };
  };
  await t.session();
  assert.equal(seen.step.isError, undefined, text(seen.step));
});

test("the panel is told: the go-ahead sends the approved Plan, and each step event names its Plan item", async () => {
  const t = await newCore();
  tutor = async function* (call) {
    await call("set_plan", PLAN);
    await call("plan_ahead", { summary: "Containers first." });
    await call("begin_step", step("s1", "Container"));
    yield { type: "text", text: "done" };
  };
  const events = await t.session();
  const plans = events.filter((e) => e.type === "tutor_plan");
  assert.equal(plans.at(-1).plan.approved, true, "the last Plan the panel hears about is the approved one");
  assert.equal(plans[0].plan.approved, undefined);
  assert.equal(events.find((e) => e.type === "tutor_step").item, "container");
});
