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
const launches: RunOptions[] = [];
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    launches.push(opts);
    if (opts.role === "extractor") return yield { type: "result", text: "", structured: { propositions: [], chains: [] }, usage: {} };
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
const prop = (name: string) =>
  JSON.stringify({ op: "put", proposition: { id: name.toLowerCase().replaceAll(" ", "-"), name, statement: `${name} is an idea taught before.`, aliases: [], provenance: [{ classId: "c1", message: 0 }] } }) + "\n";

async function newCore(known: string[] = [], dir = mkdtempSync(join(tmpdir(), "aidea-review-"))) {
  if (known.length) writeFileSync(join(dir, "propositions.jsonl"), known.map(prop).join(""));
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
