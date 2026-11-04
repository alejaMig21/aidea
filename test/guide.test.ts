import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

type Call = (name: string, args: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;
type RunOptions = Parameters<Adapter["run"]>[0];

// A stand-in for Claude Code: it records how the Tutor was launched and runs a script over the core's tools.
const launches: RunOptions[] = [];
let teacher: (call: Call) => AsyncGenerator<AgentEvent> = async function* () {
  yield { type: "text", text: "Look at the top bar." };
};
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    launches.push(opts);
    if (opts.role === "extractor") return yield { type: "result", text: "", structured: { propositions: [], chains: [] }, usage: {} };
    if (opts.role === "auditor") return yield { type: "result", text: "", structured: { links: [] }, usage: {} };
    if (opts.role !== "tutor") return;
    const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
    const call: Call = async (name, args) =>
      (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) })).json()).result;
    yield* teacher(call);
  },
};

const project = fixture("shop");
const cores: Awaited<ReturnType<typeof startCore>>[] = [];
async function newCore() {
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: mkdtempSync(join(tmpdir(), "aidea-guide-")) });
  cores.push(core);
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const events = async (res: Response) => (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return { core, post, events, guide: async () => (await fetch(core.url + "/guide")).json() as Promise<any> };
}
after(() => cores.forEach((c) => c.close()));

const JARGON = /\b(UML|C4|ISO|DDD|SOLID|hexagonal|polymorphism|cyclomatic|AST|CFG|idempotent|MCP|endpoint|payload|API)\b/i;
const text = (r: { content: { text: string }[] }) => r.content[0].text;

test("the app's teaching content is one structure in plain words: what each part is, a question, an example, something to try, and the order to tell them in", async () => {
  const { guide } = await newCore();
  const g = (await guide()).guide;
  for (const k of ["name", "what", "question", "example"]) assert.ok(typeof g[k] === "string" && g[k].trim(), k);
  assert.ok(g.order.length >= 6, "the main parts are all there");
  assert.deepEqual([...g.order].sort(), Object.keys(g.elements).sort(), "order lists exactly the parts");
  assert.equal(g.order[0], "first look", "the first part is what the person sees first");
  for (const [id, e] of Object.entries<any>(g.elements)) {
    for (const k of ["name", "hint", "what", "question", "example", "narration", "tryIt"]) {
      assert.ok(typeof e[k] === "string" && e[k].trim(), `${id}.${k}`);
      assert.doesNotMatch(e[k], JARGON, `${id}.${k} is plain words`);
    }
  }
  assert.doesNotMatch(JSON.stringify([g.what, g.question, g.example]), JARGON);
});

test("every name the guide puts in quotes is a label or word the interface really has", async () => {
  const { guide } = await newCore();
  const dir = new URL("../src/ui/", import.meta.url);
  const ui = [readFileSync(new URL("index.html", dir), "utf8"), ...readdirSync(new URL("features/", dir)).map((f) => readFileSync(new URL(`features/${f}`, dir), "utf8"))].join("\n");
  const quoted = new Set<string>();
  for (const e of Object.values<any>((await guide()).guide.elements)) {
    for (const k of ["what", "example", "narration", "tryIt"]) for (const m of String(e[k]).matchAll(/"([^"]+)"/g)) quoted.add(m[1]);
  }
  assert.ok(quoted.size >= 12, "the guide names the real buttons");
  for (const label of quoted) assert.ok(ui.includes(label), `the interface has no "${label}"`);
});

test("the guide says Playback names \"Guess first\" and the narration", async () => {
  const els = (await (await newCore()).guide()).guide.elements;
  assert.match(els.playback.what, /"Guess first"/);
  assert.match(els.playback.what, /narrat|sentence/i);
});

test("the guide class starts the Tutor with the app content as data and a first step about what the person sees, not a lecture", async () => {
  const t = await newCore();
  launches.length = 0;
  const events = await t.events(await t.post("/tutor/classes", { project, guide: true }));
  const tutor = launches.find((l) => l.role === "tutor")!;
  const g = (await t.guide()).guide;
  assert.match(tutor.message, /how aidea works/i);
  for (const id of g.order) assert.ok(tutor.message.includes(JSON.stringify(g.elements[id].tryIt)), `the message carries the try-it of ${id}`);
  assert.match(tutor.message, /begin_step/);
  assert.match(tutor.message, /predict/);
  assert.match(tutor.message, /FIRST step[^\n]*what[^\n]*(sees|see)/i, "the first step starts from what the person sees");
  assert.match(tutor.message, /not a lecture/i);
  assert.match(tutor.message, /only what the content says|do not invent/i, "the Tutor is told not to invent features");
  assert.doesNotMatch(tutor.message, /propose_node/, "this class makes no proposals");
  assert.ok(events.some((e) => e.type === "text"));
});

test("the guide class does not touch the Plan and ignores it: a step needs no Plan item, and no review question opens it", async () => {
  const t = await newCore();
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    seen.plan = await call("set_plan", { concepts: [{ name: "Queue", dependsOn: [] }], decisions: [] });
    seen.get = await call("get_plan", {});
    seen.begin = await call("begin_step", { stepId: "s1", title: "The top bar" });
    yield { type: "text", text: "done" };
  };
  launches.length = 0;
  await t.events(await t.post("/tutor/classes", { project, guide: true }));
  assert.equal(seen.plan.isError, true);
  assert.equal(seen.get.isError, true);
  assert.match(text(seen.plan), /about aidea itself/);
  assert.equal(seen.begin.isError, undefined, text(seen.begin));
  assert.doesNotMatch(launches.find((l) => l.role === "tutor")!.message, /review question/i);
  assert.match(launches.find((l) => l.role === "tutor")!.message, /get_plan|set_plan/, "the message tells the Tutor to leave the Plan alone");
  // A normal free class on the same project still sets a Plan, and then a step needs one of its items.
  teacher = async function* (call) {
    await call("set_plan", { concepts: [{ name: "Queue", dependsOn: [] }], decisions: [] });
    seen.free = await call("begin_step", { stepId: "s1", title: "Anything" });
    yield { type: "text", text: "done" };
  };
  await t.events(await t.post("/tutor/classes", { project }));
  assert.equal(seen.free.isError, true);
  assert.match(text(seen.free), /item/);
});

test("the guide class makes no proposals: the core refuses propose_node and propose_change with a message the Teacher can act on", async () => {
  const t = await newCore();
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    seen.node = await call("propose_node", { layer: "requirements", node: { id: "r1", title: "T" }, element: "requirements:r1" });
    seen.change = await call("propose_change", { layer: "requirements", id: "r1", changes: { title: "U" }, element: "requirements:r1" });
    yield { type: "text", text: "done" };
  };
  await t.events(await t.post("/tutor/classes", { project, guide: true }));
  for (const r of [seen.node, seen.change]) {
    assert.equal(r.isError, true);
    assert.match(text(r), /about aidea itself/);
    assert.match(text(r), /without proposing|do not propose|no proposals/i, "it says what to do instead");
  }
});

test("guide must be true or absent", async () => {
  const t = await newCore();
  const res = await t.post("/tutor/classes", { project, guide: "yes" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /guide/);
});
