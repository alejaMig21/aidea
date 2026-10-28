import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

type RunOptions = Parameters<Adapter["run"]>[0];
type Call = (name: string, args: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;

// A stand-in for Claude Code: the Prober is a script over the core's MCP tools.
let prober: (call: Call, opts: RunOptions) => AsyncGenerator<AgentEvent> = async function* () {};
const launches: RunOptions[] = [];
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }, { id: "sonnet", label: "Sonnet" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    launches.push(opts);
    if (opts.role !== "prober" && opts.role !== "tutor") return;
    const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
    const rpc = async (method: string, params: unknown = {}) =>
      (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method, params }) })).json()).result;
    const call: Call = (name, args) => rpc("tools/call", { name, arguments: args });
    (call as any).list = () => rpc("tools/list");
    yield* prober(call, opts);
  },
};

const project = fixture("shop");
const cores: Awaited<ReturnType<typeof startCore>>[] = [];
const prop = (name: string, aliases: string[] = []) =>
  JSON.stringify({ op: "put", proposition: { id: name.toLowerCase().replaceAll(" ", "-"), name, statement: `${name} is an idea.`, aliases, provenance: [{ classId: "c1", message: 0 }] } }) + "\n";

async function newCore(known: string[] = [], learnerModel?: string) {
  const dir = mkdtempSync(join(tmpdir(), "aidea-probe-"));
  if (known.length) writeFileSync(join(dir, "propositions.jsonl"), known.join(""));
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: dir, learnerModel });
  cores.push(core);
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
  const post = (path: string, body: unknown = {}, signal?: AbortSignal) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  const get = async (path: string) => (await fetch(core.url + path)).json() as Promise<any>;
  // Runs a Probe, answering each question with `reply(question)`. `stopWhen` is the person closing the stream at that event.
  const runProbe = async (body: Record<string, unknown> = {}, reply: (q: any) => Record<string, unknown> = () => ({ text: "an answer" }), stopWhen?: (e: any) => boolean | Promise<boolean | void>) => {
    const abort = new AbortController();
    const res = await post("/tutor/probes", { project, layer: "architecture", ...body }, abort.signal);
    const out: any[] = [];
    let buf = "";
    try {
      for await (const chunk of res.body as any) {
        buf += Buffer.from(chunk).toString();
        const lines = buf.split("\n");
        buf = lines.pop()!;
        for (const line of lines) {
          if (!line) continue;
          const e = JSON.parse(line);
          out.push(e);
          if (await stopWhen?.(e)) return abort.abort(), out;
          if (e.type === "tutor_question") await post("/tutor/answer", { id: e.id, secret: e.secret, ...reply(e) });
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") throw e;
    }
    return out;
  };
  const evidence = async () => (await get(`/learner/evidence?project=${encodeURIComponent(project)}`)).entries as any[];
  return { core, post, get, runProbe, evidence };
}
after(() => cores.forEach((c) => c.close()));

const text = (r: { content: { text: string }[] }) => r.content[0].text;
const q = (idea: string, extra: Record<string, unknown> = {}) => ({ idea, kind: "choice", prompt: `What is ${idea}?`, options: ["A box", "A wire", "A rule"], correct: "A box", ...extra });
const GOOD = { topics: [{ name: "container", status: "known", note: "Picked the right option." }, { name: "boundary", status: "unknown", note: "Skipped." }] };

test("at most five questions are accepted; the sixth is refused with words telling the model to call probe_done", async () => {
  const t = await newCore();
  const seen: any[] = [];
  prober = async function* (call) {
    for (const idea of ["container", "relationship", "boundary", "one", "two", "three"]) seen.push(await call("ask", q(idea)));
    yield { type: "text", text: "done" };
  };
  const events = await t.runProbe({}, () => ({ option: 0, confidence: 50 }));
  assert.deepEqual(seen.map((r) => r.isError ?? false), [false, false, false, false, false, true]);
  assert.match(text(seen[5]), /probe_done/);
  const asked = events.filter((e) => e.type === "tutor_question");
  assert.equal(asked.length, 5);
  assert.deepEqual(asked.map((e) => e.probe), [1, 2, 3, 4, 5].map((n) => ({ n, of: 5 })));
  assert.ok(asked.every((e) => e.skippable === true && e.correct === undefined), "every card can be skipped and never carries the committed answer");
});

test("a question about an idea already in the Learner graph is refused; the same idea is not asked twice; known_ideas gives names only", async () => {
  const t = await newCore([prop("Container", ["docker box"]), prop("Dependency")]);
  const seen: Record<string, any> = {};
  prober = async function* (call) {
    seen.known = await call("known_ideas", {});
    seen.byName = await call("ask", q("  CONTAINER!! "));
    seen.byAlias = await call("ask", q("Docker Box"));
    seen.noIdea = await call("ask", { ...q("x"), idea: undefined });
    seen.fresh = await call("ask", q("Boundary"));
    seen.again = await call("ask", q("boundary"));
    yield { type: "text", text: "x" };
  };
  const events = await t.runProbe({}, () => ({ option: 0 }));
  assert.deepEqual(JSON.parse(text(seen.known)), { ok: true, ideas: ["Container", "Dependency"] });
  assert.equal(seen.byName.isError, true);
  assert.match(text(seen.byName), /already|Learner graph/i);
  assert.equal(seen.byAlias.isError, true);
  assert.match(text(seen.noIdea), /idea/);
  assert.equal(seen.fresh.isError, undefined);
  assert.equal(seen.again.isError, true);
  assert.equal(events.filter((e) => e.type === "tutor_question").length, 1, "only the fresh idea reached the person");
});

test("every probe answer is Evidence tagged probe; 'I already know this' is Evidence of kind probe-skip and counts as known", async () => {
  const t = await newCore();
  const seen: Record<string, any> = {};
  prober = async function* (call) {
    seen.a = await call("ask", q("Container"));
    seen.b = await call("ask", q("Relationship"));
    seen.c = await call("ask", { idea: "Boundary", kind: "text", prompt: "Where does a boundary sit?" });
    yield { type: "text", text: "x" };
  };
  await t.runProbe({}, (e) => (e.prompt.includes("Container") ? { option: 1, confidence: 90 } : e.prompt.includes("Relationship") ? { skip: true } : { text: "around a system" }));
  const ev = await t.evidence();
  assert.deepEqual(ev.map((e) => [e.phase, e.kind, e.idea]), [["probe", "choice", "container"], ["probe", "probe-skip", "relationship"], ["probe", "text", "boundary"]]);
  assert.equal(ev[0].correct, false);
  assert.equal(ev[0].sureAndWrong, true);
  assert.equal(ev[1].correct, null);
  assert.match(text(seen.b), /known/i);
  assert.equal(JSON.parse(text(seen.b)).skipped, true);
  assert.equal(JSON.parse(text(seen.a)).correct, false);
});

test("'I already know this' is accepted only on probe questions: a class question refuses skip", async () => {
  const t = await newCore();
  prober = async function* (call) {
    await call("begin_step", { stepId: "s1", title: "T" });
    await call("predict", { stepId: "s1", prompt: "Guess?" });
    yield { type: "text", text: "x" };
  };
  const res = await t.post("/tutor/classes", { project });
  let status = 0;
  let body: any;
  let buf = "";
  for await (const chunk of res.body as any) {
    buf += Buffer.from(chunk).toString();
    const line = buf.split("\n").find((l) => l.includes("tutor_question"));
    if (!line) continue;
    const e = JSON.parse(line);
    const r = await t.post("/tutor/answer", { id: e.id, secret: e.secret, skip: true });
    status = r.status;
    body = await r.json();
    await t.post("/tutor/answer", { id: e.id, secret: e.secret, text: "g" });
    break;
  }
  assert.equal(status, 400);
  assert.match(body.error, /text|dontKnow/);
});

test("probe_done rejects a malformed result with words the model can act on, then accepts a good one and ends the Probe", async () => {
  const t = await newCore();
  const seen: Record<string, any> = {};
  prober = async function* (call) {
    seen.none = await call("probe_done", {});
    seen.empty = await call("probe_done", { topics: [] });
    seen.notList = await call("probe_done", { topics: "container" });
    seen.noName = await call("probe_done", { topics: [{ status: "known", note: "x" }] });
    seen.badStatus = await call("probe_done", { topics: [{ name: "container", status: "mastered", note: "x" }] });
    seen.noNote = await call("probe_done", { topics: [{ name: "container", status: "known" }] });
    seen.extra = await call("probe_done", { topics: [{ name: "container", status: "known", note: "x", score: 9 }] });
    seen.good = await call("probe_done", GOOD);
    seen.after = await call("ask", q("Container"));
    seen.twice = await call("probe_done", GOOD);
    yield { type: "text", text: "bye" };
  };
  const events = await t.runProbe();
  for (const k of ["none", "empty", "notList", "noName", "badStatus", "noNote", "extra"]) assert.equal(seen[k].isError, true, k);
  assert.match(text(seen.none), /topics/);
  assert.match(text(seen.noName), /topics\[0\]\.name/);
  assert.match(text(seen.badStatus), /known.*partial.*unknown/s);
  assert.match(text(seen.noNote), /note/);
  assert.match(text(seen.extra), /score/);
  assert.equal(seen.good.isError, undefined);
  assert.equal(seen.after.isError, true);
  assert.match(text(seen.after), /finished|ended|done/i);
  assert.equal(seen.twice.isError, true);
  const done = events.find((e) => e.type === "probe_done");
  assert.deepEqual(done.topics, GOOD.topics);
  assert.deepEqual(done.counts, { known: 1, partial: 0, unknown: 1 });
  assert.equal(done.layer, "architecture");
});

test("the result is stored per Project and layer and returned by GET; the Probe of that layer is not repeated unless redo is true", async () => {
  const t = await newCore();
  prober = async function* (call) {
    await call("probe_done", GOOD);
    yield { type: "text", text: "x" };
  };
  assert.equal((await t.get(`/tutor/probes?project=${encodeURIComponent(project)}&layer=architecture`)).result, null);
  await t.runProbe();
  const stored = (await t.get(`/tutor/probes?project=${encodeURIComponent(project)}&layer=architecture`)).result;
  assert.deepEqual(stored.topics, GOOD.topics);
  assert.equal(stored.status, "done");
  assert.equal((await t.get(`/tutor/probes?project=${encodeURIComponent(project)}&layer=business`)).result, null, "another layer has none");

  launches.length = 0;
  const again = await t.runProbe();
  assert.equal(launches.filter((l) => l.role === "prober").length, 0, "no Prober was launched");
  assert.deepEqual(again.map((e) => [e.type, e.already]), [["probe_done", true]]);
  assert.deepEqual(again[0].topics, GOOD.topics);

  await t.runProbe({ redo: true });
  assert.equal(launches.filter((l) => l.role === "prober").length, 1, "redo launches it again");
  assert.equal((await t.post("/tutor/probes", { project, layer: "architecture", redo: "yes" })).status, 400);
});

test("a stored result survives a restart of the core (it lives in the per-user folder)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-probe-"));
  prober = async function* (call) {
    await call("probe_done", GOOD);
    yield { type: "text", text: "x" };
  };
  for (const second of [false, true]) {
    const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: dir });
    cores.push(core);
    await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
    if (!second) await (await fetch(core.url + "/tutor/probes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, layer: "components" }) })).text();
    const body = await (await fetch(core.url + `/tutor/probes?project=${encodeURIComponent(project)}&layer=components`)).json();
    assert.equal(body.result?.status, "done", `run ${second ? 2 : 1}`);
  }
});

test("the person skips the whole Probe: nothing more is asked, the Probe ends, the skip is stored, and nothing blocks a class", async () => {
  const t = await newCore();
  const seen: any[] = [];
  prober = async function* (call) {
    seen.push(await call("ask", q("Container")));
    seen.push(await call("ask", q("Relationship")));
    yield { type: "text", text: "x" };
  };
  let questions = 0;
  const events = await t.runProbe({}, () => ({ option: 0 }), async (e) => {
    if (e.type !== "tutor_question") return false;
    if (++questions === 1) {
      const res = await t.post("/tutor/probes/skip", { project, layer: "architecture" });
      assert.equal(res.status, 200);
    }
    return false;
  });
  assert.equal(questions, 1, "no question after the skip");
  assert.ok(events.some((e) => e.type === "probe_skipped"));
  assert.equal(seen[0].isError, true, "the waiting question was withdrawn");
  assert.equal(seen[1].isError, true, "a later question is refused");
  assert.match(text(seen[1]), /skipped/);
  const stored = (await t.get(`/tutor/probes?project=${encodeURIComponent(project)}&layer=architecture`)).result;
  assert.equal(stored.status, "skipped");
  assert.deepEqual(stored.topics, []);
});

test("skipping when no Probe is running stores the skip; closing the stream ends the Probe and stores nothing", async () => {
  const t = await newCore();
  assert.equal((await t.post("/tutor/probes/skip", { project, layer: "business" })).status, 200);
  assert.equal((await t.get(`/tutor/probes?project=${encodeURIComponent(project)}&layer=business`)).result.status, "skipped");
  assert.equal((await t.post("/tutor/probes/skip", { project, layer: "nonsense" })).status, 400);

  let ended = false;
  prober = async function* (call) {
    const r = await call("ask", q("Container"));
    ended = r.isError === true;
    yield { type: "text", text: "x" };
  };
  await t.runProbe({ layer: "requirements" }, () => ({ option: 0 }), (e) => e.type === "tutor_question");
  for (let i = 0; i < 50 && !ended; i++) await new Promise((r) => setTimeout(r, 50));
  assert.ok(ended, "the waiting question was withdrawn");
  assert.equal((await t.get(`/tutor/probes?project=${encodeURIComponent(project)}&layer=requirements`)).result, null);
});

test("the Prober gets its own short instructions, the layer's concepts as data in the first message, the haiku default and the read tools", async () => {
  const t = await newCore();
  launches.length = 0;
  let names: string[] = [];
  prober = async function* (call) {
    names = (await (call as any).list()).tools.map((x: any) => x.name);
    yield { type: "text", text: "x" };
  };
  await t.runProbe({ layer: "requirements" });
  const opts = launches.find((l) => l.role === "prober")!;
  assert.ok(opts.instructions!.length < 4000, `instructions are ${opts.instructions!.length} characters`);
  for (const word of ["ask", "known_ideas", "probe_done", "idea"]) assert.ok(opts.instructions!.includes(word), word);
  assert.match(opts.instructions!, /aidea/);
  for (const concept of ["functional vs non-functional requirement", "acceptance criteria"]) assert.ok(opts.message.includes(concept), concept);
  assert.ok(!opts.message.includes("container"), "only this layer's concepts");
  assert.equal(opts.model, "haiku");
  assert.deepEqual(names, ["ask", "known_ideas", "probe_done", "read_layers", "read_node", "list_files", "read_file", "read_recording"]);

  launches.length = 0;
  await t.runProbe({ layer: "business", redo: true, model: "sonnet" });
  assert.equal(launches.find((l) => l.role === "prober")!.model, "sonnet");
  launches.length = 0;
  assert.equal((await t.post("/tutor/probes", { project, layer: "algorithms", model: "gpt" })).status, 400);
  const other = await newCore([], "sonnet");
  await other.runProbe({ layer: "components" });
  assert.equal(launches.find((l) => l.role === "prober")!.model, "sonnet", "the learner model setting is the default");
});

test("the request is checked: an open Project and a known layer", async () => {
  const t = await newCore();
  assert.equal((await t.post("/tutor/probes", { project: "/nope", layer: "architecture" })).status, 400);
  const bad = await t.post("/tutor/probes", { project, layer: "plumbing" });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /business.*requirements.*architecture.*components.*algorithms/s);
  assert.equal((await fetch(t.core.url + `/tutor/probes?project=${encodeURIComponent(project)}&layer=plumbing`)).status, 400);
  assert.equal((await fetch(t.core.url + `/tutor/probes?project=%2Fnope&layer=business`)).status, 400);
});

test("a Prober that ends without handing over a result is reported and stores nothing", async () => {
  const t = await newCore();
  prober = () => (async function* () { yield { type: "text", text: "I forgot" } as AgentEvent; })();
  const events = await t.runProbe({ layer: "algorithms" });
  assert.ok(events.some((e) => e.type === "error" && /result/i.test(e.message)));
  assert.equal((await t.get(`/tutor/probes?project=${encodeURIComponent(project)}&layer=algorithms`)).result, null);
});
