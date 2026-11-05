import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// tutor-rewrite 02: the Tutor measures what the person knows INSIDE the conversation (it replaces the Probe): a question per topic it chooses, then one hand-over with a bracket per topic.
type RunOptions = Parameters<Adapter["run"]>[0];
type Call = (name: string, args: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;

let tutor: (call: Call, opts: RunOptions) => AsyncGenerator<AgentEvent> = async function* () {};
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }, { id: "sonnet", label: "Sonnet" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    if (opts.role !== "tutor") return;
    const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
    const rpc = async (method: string, params: unknown = {}) =>
      (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method, params }) })).json()).result;
    const call: Call = (name, args) => rpc("tools/call", { name, arguments: args });
    (call as any).list = () => rpc("tools/list");
    yield* tutor(call, opts);
  },
};

const project = fixture("shop");
const cores: Awaited<ReturnType<typeof startCore>>[] = [];
const prop = (name: string, aliases: string[] = []) =>
  JSON.stringify({ op: "put", proposition: { id: name.toLowerCase().replaceAll(" ", "-"), name, statement: `${name} is an idea.`, aliases, provenance: [{ classId: "c1", message: 0 }] } }) + "\n";

async function newCore(known: string[] = [], dir = mkdtempSync(join(tmpdir(), "aidea-measure-"))) {
  if (known.length) writeFileSync(join(dir, "propositions.jsonl"), known.join(""));
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: dir });
  cores.push(core);
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
  const post = (path: string, body: unknown = {}) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const get = async (path: string) => (await fetch(core.url + path)).json() as Promise<any>;
  // Runs a session, answering each question with `reply(question)`.
  const session = async (reply: (q: any) => Record<string, unknown> = (q) => (q.kind === "choice" ? { option: 0, confidence: 90 } : { text: "an answer" })) => {
    const res = await post("/tutor/classes", { project, message: "I want to understand how this shop is organised" });
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
  const evidence = async () => (await get(`/learner/evidence?project=${encodeURIComponent(project)}`)).entries as any[];
  return { core, dir, post, get, session, evidence };
}
after(() => cores.forEach((c) => c.close()));

const text = (r: { content: { text: string }[] }) => r.content[0].text;
const q = (topic: string, extra: Record<string, unknown> = {}) => ({ topic, kind: "choice", prompt: `What is ${topic}?`, options: ["A box", "A wire", "A rule"], correct: "A box", ...extra });
const GOOD = { topics: [{ name: "container", floor: "Names a container in the shop.", ceiling: "Cannot say what a boundary is.", note: "Knows the pieces, not their limits." }, { name: "boundary", floor: null, ceiling: "Has not met the word.", note: "New to it." }] };

test("the Tutor measures inside the session: it asks, records one bracket per topic, and the hand-over is accepted once; a second one and more questions are refused", async () => {
  const t = await newCore();
  const seen: any = {};
  tutor = async function* (call) {
    seen.q1 = await call("measure", q("container"));
    seen.q2 = await call("measure", q("boundary"));
    seen.done = await call("measure_done", GOOD);
    seen.again = await call("measure_done", GOOD);
    seen.more = await call("measure", q("relationship"));
    yield { type: "text", text: "done" };
  };
  const events = await t.session();
  assert.equal(seen.q1.isError, undefined, text(seen.q1));
  assert.equal(seen.done.isError, undefined, text(seen.done));
  assert.equal(seen.again.isError, true);
  assert.match(text(seen.again), /already|once/i);
  assert.equal(seen.more.isError, true);
  assert.match(text(seen.more), /finished|done/i);
  const done = events.find((e) => e.type === "measure_done");
  assert.deepEqual(done.topics.map((x: any) => x.name), ["container", "boundary"]);
  const stored = (await t.get(`/tutor/measure?project=${encodeURIComponent(project)}`)).result;
  assert.equal(stored.topics[0].floor, "Names a container in the shop.");
  assert.equal(stored.topics[1].floor, null);
  assert.equal(stored.questions, 2);
});

test("a topic the Learner graph already holds is not asked again, and the same topic is not asked twice", async () => {
  const t = await newCore([prop("Container")]);
  const seen: any = {};
  tutor = async function* (call) {
    seen.held = await call("measure", q("container"));
    seen.first = await call("measure", q("relationship"));
    seen.twice = await call("measure", q("Relationship"));
    yield { type: "text", text: "done" };
  };
  await t.session();
  assert.equal(seen.held.isError, true);
  assert.match(text(seen.held), /already holds/i);
  assert.equal(seen.first.isError, undefined);
  assert.equal(seen.twice.isError, true);
  assert.match(text(seen.twice), /already asked/i);
});

test("at most twelve questions; the thirteenth is refused with words telling the model to hand over", async () => {
  const t = await newCore();
  const results: any[] = [];
  tutor = async function* (call) {
    for (let i = 0; i < 13; i++) results.push(await call("measure", q(`topic number ${i}`)));
    yield { type: "text", text: "done" };
  };
  await t.session();
  assert.equal(results.slice(0, 12).filter((r) => r.isError).length, 0);
  assert.equal(results[12].isError, true);
  assert.match(text(results[12]), /measure_done/);
});

test("'I already know this' counts as known: it is Evidence of kind probe-skip, and the result says so", async () => {
  const t = await newCore();
  const seen: any = {};
  tutor = async function* (call) {
    seen.skipped = await call("measure", q("container"));
    yield { type: "text", text: "done" };
  };
  await t.session((e) => (e.skippable ? { skip: true } : { text: "x" }));
  const r = JSON.parse(text(seen.skipped));
  assert.equal(r.skipped, true);
  assert.equal(r.known, true);
  const entry = (await t.evidence()).find((x) => x.kind === "probe-skip");
  assert.ok(entry, "the skip is recorded");
  assert.equal(entry.idea, "container");
});

test("every answer is Evidence tagged probe, and the question is numbered for the interface", async () => {
  const t = await newCore();
  tutor = async function* (call) {
    await call("measure", q("container"));
    yield { type: "text", text: "done" };
  };
  const events = await t.session((e) => (e.kind === "choice" ? { option: 0, confidence: 90 } : { text: "x" }));
  const asked = events.find((e) => e.type === "tutor_question");
  assert.equal(asked.skippable, true);
  assert.equal(asked.probe.n, 1);
  const entry = (await t.evidence()).find((x) => x.phase === "probe");
  assert.ok(entry && entry.idea === "container");
});

test("measure_done rejects a malformed hand-over with words the model can act on", async () => {
  const t = await newCore();
  const r: any[] = [];
  tutor = async function* (call) {
    r.push(await call("measure_done", { topics: [] }));
    r.push(await call("measure_done", { topics: [{ name: "x", floor: "a", note: "n" }] }));
    r.push(await call("measure_done", { topics: [{ name: "x", floor: 5, ceiling: "b", note: "n" }] }));
    r.push(await call("measure_done", { topics: [{ name: "x", floor: "a", ceiling: "b", note: "n", extra: 1 }] }));
    r.push(await call("measure_done", { topics: [{ name: "x", floor: "a", ceiling: "b", note: "n" }, { name: "X", floor: "a", ceiling: "b", note: "n" }] }));
    yield { type: "text", text: "done" };
  };
  await t.session();
  assert.ok(r.every((x) => x.isError === true));
  assert.match(text(r[0]), /topics/);
  assert.match(text(r[1]), /ceiling/);
  assert.match(text(r[2]), /floor/);
  assert.match(text(r[3]), /extra/);
  assert.match(text(r[4]), /twice|same/i);
});

test("the stored measurement is returned to the Plan (get_plan) and survives a restart of the core", async () => {
  const t = await newCore();
  const seen: any = {};
  tutor = async function* (call) {
    seen.before = JSON.parse(text(await call("get_plan", {})));
    await call("measure_done", GOOD);
    seen.after = JSON.parse(text(await call("get_plan", {})));
    yield { type: "text", text: "done" };
  };
  await t.session();
  assert.equal(seen.before.measure, null);
  assert.equal(seen.after.measure.topics[0].name, "container");
  assert.equal(seen.after.probes, undefined, "the per-layer Probe results are gone");
  const again = await newCore([], t.dir);
  assert.equal((await again.get(`/tutor/measure?project=${encodeURIComponent(project)}`)).result.topics.length, 2);
});

test("the Probe is gone: its route does not exist, and the Tutor's tools and instructions carry the measurement", async () => {
  const t = await newCore();
  assert.equal((await t.post("/tutor/probes", { project, layer: "architecture" })).status, 404);
  const seen: any = {};
  tutor = async function* (call, opts) {
    seen.tools = ((await (call as any).list()).tools as any[]).map((x) => x.name);
    seen.instructions = opts.instructions;
    yield { type: "text", text: "done" };
  };
  await t.session();
  assert.ok(seen.tools.includes("measure") && seen.tools.includes("measure_done"));
  assert.match(seen.instructions, /measure_done/);
  assert.doesNotMatch(seen.instructions, /probe_done|Probe/);
});
