import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { TUTOR_INSTRUCTIONS } from "../src/core/tutor.ts";
import { fixture } from "./helpers.ts";

type Call = (name: string, args: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;
type RunOptions = Parameters<Adapter["run"]>[0];

// A stand-in for Claude Code: the Teacher is a script over the core's MCP tools; the other roles return empty data.
let teacher: (call: Call, opts: RunOptions) => AsyncGenerator<AgentEvent> = async function* () {};
let extracted: unknown = { propositions: [], chains: [] };
const launches: RunOptions[] = [];
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    launches.push(opts);
    if (opts.role === "extractor") return yield { type: "result", text: "", structured: extracted, usage: {} };
    if (opts.role === "auditor") return yield { type: "result", text: "", structured: { links: [] }, usage: {} };
    if (opts.role === "grader") return yield { type: "result", text: "", structured: { correct: true, feedback: "ok" }, usage: {} };
    if (opts.role !== "tutor") return;
    const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
    const call: Call = async (name, args) =>
      (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) })).json()).result;
    yield* teacher(call, opts);
  },
};

const project = fixture("shop");
const cores: Awaited<ReturnType<typeof startCore>>[] = [];
// A spec is "Name", "Name|alias", with an optional "@this" (taught in this Project), "@other" (in another Project) or "#c9" (a class id, for ideas saved before
// the Project was recorded: the Project then comes from the Evidence of that class). Without any of them the Project is unknown.
const other = "C:/somewhere/else";
const prop = (spec: string) => {
  const [head, classId = "c1"] = spec.split("#");
  const [names, where] = head.split("@");
  const [name, ...aliases] = names.split("|");
  const project_ = where === "this" ? { project } : where === "other" ? { project: other } : {};
  return JSON.stringify({ op: "put", proposition: { id: name.toLowerCase().replaceAll(" ", "-"), name, statement: `${name} is an idea taught before.`, aliases, provenance: [{ classId, message: 0, ...project_ }] } }) + "\n";
};
const evidenceRow = (classId: string, forProject: string) =>
  JSON.stringify({ classId, questionId: "q-1", project: forProject, kind: "text", correct: null, confidence: null, answer: null, thought: null, dontKnow: false, time: "2026-01-01T00:00:00.000Z" }) + "\n";

async function newCore(known: string[] = [], dir = mkdtempSync(join(tmpdir(), "aidea-review-")), evidenceRows: [string, string][] = []) {
  if (known.length) writeFileSync(join(dir, "propositions.jsonl"), known.map(prop).join(""));
  if (evidenceRows.length) writeFileSync(join(dir, "evidence.jsonl"), evidenceRows.map(([c, p]) => evidenceRow(c, p)).join(""));
  const preferencesFile = join(dir, "preferences.json");
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: dir, preferencesFile });
  cores.push(core);
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const get = async (path: string) => (await fetch(core.url + path)).json() as Promise<any>;
  const runClass = async (body: Record<string, unknown> = {}, reply: (q: any) => Record<string, unknown> = () => ({ text: "an answer" })) => {
    const res = await post("/tutor/classes", { project, ...body });
    const out: any[] = [];
    let buf = "";
    for await (const chunk of res.body as any) {
      buf += Buffer.from(chunk).toString();
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const line of lines.filter(Boolean)) {
        const e = JSON.parse(line);
        out.push(e);
        if (e.type === "tutor_question") await post("/tutor/answer", { id: e.id, secret: e.secret, ...reply(e) });
      }
    }
    return out;
  };
  return { core, dir, post, get, runClass, evidence: async () => (await get(`/learner/evidence?project=${encodeURIComponent(project)}`)).entries as any[] };
}
after(() => cores.forEach((c) => c.close()));

const text = (r: { content: { text: string }[] }) => r.content[0].text;
const reviewQ = { kind: "choice", prompt: "What is a queue for?", options: ["Holding work", "Storing users", "Drawing"], correct: "Holding work" };
const tutorMessage = () => launches.filter((l) => l.role === "tutor").at(-1)!.message;

test("a class starts with one review question about an idea from an earlier class, and the first step waits for it", async () => {
  const t = await newCore(["Queue"]);
  launches.length = 0;
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    seen.early = await call("begin_step", { stepId: "s1", title: "Something new" });
    seen.review = await call("review", reviewQ);
    seen.again = await call("review", reviewQ);
    seen.begin = await call("begin_step", { stepId: "s1", title: "Something new" });
    yield { type: "text", text: "done" };
  };
  const events = await t.runClass({}, () => ({ option: 0, confidence: 70 }));
  assert.match(tutorMessage(), /Queue/);
  assert.match(tutorMessage(), /Queue is an idea taught before/);
  assert.match(tutorMessage(), /review/i);
  assert.equal(seen.early.isError, true);
  assert.match(text(seen.early), /review/i);
  assert.equal(seen.review.isError, undefined);
  assert.equal(JSON.parse(text(seen.review)).correct, true);
  assert.equal(seen.again.isError, true);
  assert.equal(seen.begin.isError, undefined);
  const q = events.find((e) => e.type === "tutor_question");
  assert.equal(q.phase, "review");
  assert.equal(q.correct, undefined, "the committed answer never leaves the core");
});

test("with an empty graph there is no review question and the class goes straight to its first step", async () => {
  const t = await newCore();
  launches.length = 0;
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    seen.review = await call("review", reviewQ);
    seen.begin = await call("begin_step", { stepId: "s1", title: "First" });
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  assert.doesNotMatch(tutorMessage(), /review question/i);
  assert.equal(seen.review.isError, true);
  assert.match(text(seen.review), /no review/i);
  assert.equal(seen.begin.isError, undefined);
});

test("the answer is Evidence about that idea and the graph does not change", async () => {
  const t = await newCore(["Queue"]);
  const before = JSON.stringify((await t.get("/learner/graph")));
  teacher = async function* (call) {
    await call("review", reviewQ);
    yield { type: "text", text: "done" };
  };
  await t.runClass({}, () => ({ option: 1, confidence: 90 }));
  const ev = await t.evidence();
  assert.equal(ev.length, 1);
  assert.deepEqual([ev[0].phase, ev[0].idea, ev[0].correct, ev[0].sureAndWrong], ["review", "queue", false, true]);
  assert.equal(JSON.stringify(await t.get("/learner/graph")), before);
});

test("it never asks about the idea the class is about to teach, and rotates through the others", async () => {
  const t = await newCore(["Queue", "Worker"]);
  teacher = async function* (call) {
    await call("review", reviewQ);
    yield { type: "text", text: "done" };
  };
  launches.length = 0;
  await t.runClass({ topic: "Queue basics" }, () => ({ option: 0, confidence: 50 }));
  assert.match(tutorMessage(), /Worker is an idea taught before/);
  assert.doesNotMatch(tutorMessage(), /Queue is an idea taught before/);
  launches.length = 0;
  await t.runClass({}, () => ({ option: 0, confidence: 50 }));
  assert.match(tutorMessage(), /Queue is an idea taught before/, "Worker was just reviewed, so Queue is next");
  const only = await newCore(["Queue"]);
  launches.length = 0;
  await only.runClass({ topic: "queue" });
  assert.doesNotMatch(tutorMessage(), /review question/i, "the only idea is the one being taught");
});

test("the person can turn it off, the choice is remembered", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-review-"));
  const t = await newCore(["Queue"], dir);
  assert.equal((await t.get(`/agent-options?project=${encodeURIComponent(project)}`)).reviewQuestion, true);
  assert.equal((await t.post("/agent-options", { project, reviewQuestion: "no" })).status, 400);
  assert.equal((await t.post("/agent-options", { project, reviewQuestion: false })).status, 200);
  launches.length = 0;
  teacher = async function* () { yield { type: "text", text: "done" }; };
  await t.runClass();
  assert.doesNotMatch(tutorMessage(), /review question/i);
  await t.core.close();
  const again = await newCore([], dir);
  assert.equal((await again.get(`/agent-options?project=${encodeURIComponent(project)}`)).reviewQuestion, false);
});

test("the instructions teach the review tool within the size limit", () => {
  assert.match(TUTOR_INSTRUCTIONS, /review/);
  assert.ok(TUTOR_INSTRUCTIONS.length < 4000, `${TUTOR_INSTRUCTIONS.length} characters`);
});

test("a class whose Teacher never asks the review question is not stuck behind it", async () => {
  const t = await newCore(["Queue"]);
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    seen.first = await call("begin_step", { stepId: "s1", title: "One" });
    seen.second = await call("begin_step", { stepId: "s1", title: "One" });
    seen.third = await call("begin_step", { stepId: "s1", title: "One" });
    seen.late = await call("review", reviewQ);
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  assert.equal(seen.first.isError, true);
  assert.equal(seen.second.isError, true);
  assert.equal(seen.third.isError, undefined, "after two refusals the review is dropped and the class goes on");
  assert.equal(seen.late.isError, true);
  assert.deepEqual(await t.evidence(), []);
});

test("the person can always say they do not know, whatever the Teacher asked for", async () => {
  const t = await newCore(["Queue"]);
  teacher = async function* (call) {
    await call("review", { ...reviewQ, allowDontKnow: false });
    yield { type: "text", text: "done" };
  };
  const events = await t.runClass({}, () => ({ dontKnow: true }));
  assert.equal(events.find((e) => e.type === "tutor_question").allowDontKnow, true);
  assert.equal((await t.evidence())[0].dontKnow, true);
});

test("only a free class has a review question: not a class on a layer or on selected text", async () => {
  const t = await newCore(["Queue"]);
  teacher = async function* () { yield { type: "text", text: "done" }; };
  for (const body of [{ layer: "business" }, { selection: "dependency injection" }]) {
    launches.length = 0;
    await t.runClass(body);
    assert.doesNotMatch(tutorMessage(), /review question/i, JSON.stringify(body));
  }
  launches.length = 0;
  await t.runClass({ topic: "how a queue works in this shop" }, () => ({ option: 0, confidence: 50 }));
  assert.doesNotMatch(tutorMessage(), /review question/i, "the only idea is the one the topic names");
  const free = await newCore(["Queue"]);
  launches.length = 0;
  await free.runClass({ topic: "something else entirely" }, () => ({ option: 0, confidence: 50 }));
  assert.match(tutorMessage(), /review question/i, "a free class with a topic still has one");
});

test("the Teacher is told no review is due in a class that has none", async () => {
  const t = await newCore(["Queue"]);
  let answer: any;
  teacher = async function* (call) {
    answer = await call("review", reviewQ);
    yield { type: "text", text: "done" };
  };
  await t.runClass({ selection: "dependency injection" });
  assert.equal(answer.isError, true);
  assert.match(text(answer), /no review/i);
});

test("an idea known by another name is not reviewed when the topic names it", async () => {
  const t = await newCore(["Customer Segment", "Worker|job runner"]);
  launches.length = 0;
  teacher = async function* () { yield { type: "text", text: "done" }; };
  await t.runClass({ topic: "how a job runner picks work" }, () => ({ option: 0, confidence: 50 }));
  assert.match(tutorMessage(), /Customer Segment is an idea taught before/);
  assert.doesNotMatch(tutorMessage(), /Worker is an idea taught before/);
});

test("it prefers ideas taught in this Project, even when another Project's idea is older", async () => {
  const t = await newCore(["Old Idea@other", "Never Seen", "Mine@this"]);
  launches.length = 0;
  teacher = async function* () { yield { type: "text", text: "done" }; };
  await t.runClass({}, () => ({ option: 0, confidence: 50 }));
  assert.match(tutorMessage(), /Mine is an idea taught before/);
  assert.doesNotMatch(tutorMessage(), /Old Idea is an idea taught before/);
});

test("a Project with no ideas of its own falls back to the rest, and an idea of unknown Project is only in the fallback", async () => {
  const t = await newCore(["Elsewhere@other", "Unknown"]);
  launches.length = 0;
  teacher = async function* () { yield { type: "text", text: "done" }; };
  await t.runClass({}, () => ({ option: 0, confidence: 50 }));
  assert.match(tutorMessage(), /Elsewhere is an idea taught before/, "the graph's own order decides in the fallback");
  const mixed = await newCore(["Unknown", "Mine@this"]);
  launches.length = 0;
  await mixed.runClass({}, () => ({ option: 0, confidence: 50 }));
  assert.match(tutorMessage(), /Mine is an idea taught before/, "an idea of unknown Project does not compete with one of this Project");
});

test("a Project whose ideas are all about the topic gets no review, instead of one about another Project", async () => {
  const t = await newCore(["Mine@this", "Elsewhere@other"]);
  launches.length = 0;
  teacher = async function* () { yield { type: "text", text: "done" }; };
  await t.runClass({ topic: "how mine works" }, () => ({ option: 0, confidence: 50 }));
  assert.doesNotMatch(tutorMessage(), /review question/i);
});

test("an idea saved before the Project was recorded takes it from the Evidence of its class", async () => {
  const t = await newCore(["Elsewhere#c8", "Legacy#c9"], undefined, [["c8", other], ["c9", project]]);
  launches.length = 0;
  teacher = async function* () { yield { type: "text", text: "done" }; };
  await t.runClass({}, () => ({ option: 0, confidence: 50 }));
  assert.match(tutorMessage(), /Legacy is an idea taught before/);
});

test("a new idea saved by the pipeline records the Project of its class", async () => {
  const t = await newCore();
  extracted = { propositions: [{ name: "Queue holds work", statement: "A queue holds work until a worker is free.", aliases: [], message: 0 }], chains: [] };
  teacher = async function* (call) {
    await call("begin_step", { stepId: "s1", title: "Queues" });
    await call("predict", { stepId: "s1", prompt: "What is a queue for?" });
    await call("explain", { stepId: "s1", text: "A queue holds work until a worker is free." });
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  extracted = { propositions: [], chains: [] };
  const graph = await t.get("/learner/graph");
  assert.equal(graph.propositions.length, 1);
  assert.equal(graph.propositions[0].provenance[0].project, project);
});
