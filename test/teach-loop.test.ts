import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

type RunOptions = Parameters<Adapter["run"]>[0];
type Call = (name: string, args: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;

// A stand-in for Claude Code: the Teacher is a script over the core's MCP tools; the grader, extractor and auditor return scripted data.
let teacher: (call: Call) => AsyncGenerator<AgentEvent> = async function* () {};
let graderOut: (opts: RunOptions) => AgentEvent[] = () => [];
let extractorOut: () => AgentEvent[] = () => [];
const launches: RunOptions[] = [];
const ok = (structured: unknown): AgentEvent[] => [{ type: "result", text: "", structured, usage: {} }];
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    launches.push(opts);
    if (opts.role === "grader") return yield* graderOut(opts);
    if (opts.role === "extractor") return yield* extractorOut();
    if (opts.role === "auditor") return yield* ok({ links: [] });
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
  const dir = mkdtempSync(join(tmpdir(), "aidea-teach-"));
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: dir });
  cores.push(core);
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
  const post = (path: string, body: unknown = {}, signal?: AbortSignal) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  const get = async (path: string) => (await fetch(core.url + path)).json() as Promise<any>;
  // Runs a class, answering each question with `reply(question)`. `stopWhen` is the person ending the class at that event.
  const runClass = async (body: Record<string, unknown> = {}, reply: (q: any) => Record<string, unknown> = () => ({ text: "a guess" }), stopWhen?: (e: any) => boolean) => {
    const abort = new AbortController();
    const res = await post("/tutor/classes", { project, ...body }, abort.signal);
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
          if (stopWhen?.(e)) return abort.abort(), out;
          if (e.type === "tutor_question") await post("/tutor/answer", { id: e.id, secret: e.secret, ...reply(e) });
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") throw e;
    }
    return out;
  };
  const evidence = async (classId: string) => (await get(`/learner/evidence?class=${classId}`)).entries as any[];
  return { core, post, get, runClass, evidence };
}
after(() => cores.forEach((c) => c.close()));

const text = (r: { content: { text: string }[] }) => r.content[0].text;
const json = (r: { content: { text: string }[] }) => JSON.parse(text(r));
const choice = (stepId = "s1") => ({ stepId, kind: "choice", prompt: "Which one stores the data?", options: ["Queue", "Database", "Cache"], correct: "Database" });
const PREDICT = (stepId = "s1") => ({ stepId, prompt: "What do you think a queue is for?" });
// begin_step, predict (waits for the person), explain: the order the core demands before a check.
async function teachTo(call: Call, stepId = "s1") {
  await call("begin_step", { stepId, title: `Step ${stepId}` });
  await call("predict", PREDICT(stepId));
  await call("explain", { stepId, text: `The fact of ${stepId}.` });
}
const say = async function* (t: string) { yield { type: "text", text: t } as AgentEvent; };

test("the core enforces the order: begin, predict, explain, check; the model gets plain words to act on", async () => {
  const t = await newCore();
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    seen.predictFirst = await call("predict", PREDICT());
    seen.explainFirst = await call("explain", { stepId: "s1", text: "x" });
    seen.begin = await call("begin_step", { stepId: "s1", title: "What a queue is for" });
    seen.noTitle = await call("begin_step", { stepId: "s9", title: "" });
    seen.explainBeforePredict = await call("explain", { stepId: "s1", text: "x" });
    seen.checkBeforePredict = await call("ask", choice());
    seen.nextStepWhileOpen = await call("begin_step", { stepId: "s2", title: "Next" });
    seen.predict = await call("predict", PREDICT());
    seen.predictTwice = await call("predict", PREDICT());
    seen.checkBeforeExplain = await call("ask", choice());
    seen.explain = await call("explain", { stepId: "s1", text: "A queue holds work so a burst does not overload the worker." });
    seen.explainTwice = await call("explain", { stepId: "s1", text: "more" });
    seen.noStepId = await call("ask", { ...choice(), stepId: undefined });
    seen.unknownStep = await call("ask", choice("zzz"));
    seen.check = await call("ask", choice());
    yield { type: "text", text: "done" };
  };
  const events = await t.runClass({}, (q) => (q.kind === "text" ? { text: "to hold work" } : { option: 1, confidence: 50 }));
  assert.match(text(seen.predictFirst), /begin_step/);
  assert.equal(seen.predictFirst.isError, true);
  assert.match(text(seen.explainFirst), /begin_step/);
  assert.equal(seen.begin.isError, undefined);
  assert.match(text(seen.noTitle), /title/);
  assert.match(text(seen.explainBeforePredict), /predict/i);
  assert.match(text(seen.checkBeforePredict), /predict/i);
  assert.match(text(seen.nextStepWhileOpen), /s1.*(still open|finish)/is);
  assert.equal(seen.predict.isError, undefined);
  assert.match(text(seen.predictTwice), /already/i);
  assert.match(text(seen.checkBeforeExplain), /explain/i);
  assert.equal(seen.explain.isError, undefined);
  assert.match(text(seen.explainTwice), /check/i);
  assert.match(text(seen.noStepId), /stepId/);
  assert.match(text(seen.unknownStep), /begin_step/);
  assert.equal(json(seen.check).correct, true);
  assert.equal(json(seen.check).stepClosed, true);

  const types = events.map((e) => e.type);
  assert.deepEqual(types.filter((x) => x !== "text" && x !== "learner"), ["tutor_step", "tutor_question", "tutor_explain", "tutor_question"]);
  assert.deepEqual(events.find((e) => e.type === "tutor_step"), { type: "tutor_step", stepId: "s1", title: "What a queue is for" });
  const [predict, check] = events.filter((e) => e.type === "tutor_question");
  assert.deepEqual([predict.phase, predict.kind, predict.stepId], ["predict", "text", "s1"]);
  assert.deepEqual([check.phase, check.kind, check.stepId], ["check", "choice", "s1"]);
  assert.equal(events.find((e) => e.type === "tutor_explain").repair, false);
});

test("the prediction answer comes back to the Teacher, and the explanation is told to open by resolving it", async () => {
  const t = await newCore();
  let predicted: any;
  teacher = async function* (call) {
    await call("begin_step", { stepId: "s1", title: "Queues" });
    predicted = await call("predict", PREDICT());
    yield { type: "text", text: "x" };
  };
  await t.runClass({}, () => ({ text: "something that waits", thought: "like a line" }));
  const r = json(predicted);
  assert.equal(r.prediction, "something that waits");
  assert.equal(r.thought, "like a line");
  assert.match(r.next, /explain/);
  assert.match(r.next, /prediction/);
});

test("a check without a committed correct answer is rejected", async () => {
  const t = await newCore();
  const seen: any[] = [];
  teacher = async function* (call) {
    await teachTo(call);
    seen.push(await call("ask", { ...choice(), correct: undefined }));
    seen.push(await call("ask", { ...choice(), correct: "Message broker" }));
    seen.push(await call("ask", { stepId: "s1", kind: "text", prompt: "Why a queue?" }));
    seen.push(await call("ask", { stepId: "s1", kind: "text", prompt: "Why a queue?", expected: "  " }));
    yield { type: "text", text: "x" };
  };
  const events = await t.runClass();
  assert.equal(events.filter((e) => e.type === "tutor_question").length, 1, "only the prediction was ever shown");
  seen.forEach((r) => assert.equal(r.isError, true));
  assert.match(text(seen[0]), /correct/);
  assert.match(text(seen[1]), /exactly one of the options/);
  assert.match(text(seen[2]), /expected/);
  assert.match(text(seen[3]), /expected/);
});

test("a wrong check keeps the step open until a re-teach and a correct check, and every attempt is Evidence", async () => {
  const t = await newCore();
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    await teachTo(call);
    seen.wrong = await call("ask", choice());
    seen.nextStep = await call("begin_step", { stepId: "s2", title: "Next" });
    seen.recheck = await call("ask", choice());
    seen.reteach = await call("explain", { stepId: "s1", text: "Look again: the database stores the data." });
    seen.right = await call("ask", choice());
    seen.nextStepNow = await call("begin_step", { stepId: "s2", title: "Next" });
    yield { type: "text", text: "x" };
  };
  const answers = [{ option: 0, confidence: 30 }, { option: 1, confidence: 90 }];
  const events = await t.runClass({}, (q) => (q.phase === "predict" ? { text: "it is storage" } : answers.shift()!));
  const wrong = json(seen.wrong);
  assert.deepEqual([wrong.correct, wrong.stepClosed, wrong.attempt, wrong.stepId], [false, false, 1, "s1"]);
  assert.equal(wrong.sureAndWrong, undefined);
  assert.match(wrong.next, /explain/);
  assert.equal(seen.nextStep.isError, true);
  assert.match(text(seen.nextStep), /s1.*explain.*again|re-teach/is);
  assert.equal(seen.recheck.isError, true);
  assert.match(text(seen.recheck), /explain/);
  assert.equal(seen.reteach.isError, undefined);
  const right = json(seen.right);
  assert.deepEqual([right.correct, right.stepClosed, right.attempt], [true, true, 2]);
  assert.equal(seen.nextStepNow.isError, undefined);
  assert.deepEqual(events.filter((e) => e.type === "tutor_explain").map((e) => e.repair), [false, true]);

  const ev = await t.evidence(events.find((e) => e.type === "learner").classId);
  assert.deepEqual(ev.map((e) => [e.stepId, e.phase, e.attempt, e.correct]), [["s1", "predict", 1, null], ["s1", "check", 1, false], ["s1", "check", 2, true]]);
  assert.deepEqual([ev[1].confidence, ev[2].confidence], [30, 90]);
});

test("a don't-know check counts as a miss and keeps the step open", async () => {
  const t = await newCore();
  let r: any, next: any;
  teacher = async function* (call) {
    await teachTo(call);
    r = await call("ask", choice());
    next = await call("begin_step", { stepId: "s2", title: "Next" });
    yield { type: "text", text: "x" };
  };
  const events = await t.runClass({}, (q) => (q.phase === "predict" ? { dontKnow: true } : { dontKnow: true, thought: "no idea" }));
  assert.deepEqual([json(r).correct, json(r).stepClosed], [false, false]);
  assert.equal(next.isError, true);
  const ev = await t.evidence(events.find((e) => e.type === "learner").classId);
  assert.deepEqual(ev.map((e) => [e.phase, e.dontKnow, e.correct]), [["predict", true, null], ["check", true, null]]);
});

test("a wrong answer given with confidence 70 or more is marked sure_and_wrong, and the Teacher is told to repair it", async () => {
  const t = await newCore();
  const results: any[] = [];
  teacher = async function* (call) {
    await teachTo(call);
    results.push(await call("ask", choice())); // wrong at 70
    await call("explain", { stepId: "s1", text: "Again." });
    results.push(await call("ask", choice())); // wrong at 50
    await call("explain", { stepId: "s1", text: "Again, differently." });
    results.push(await call("ask", choice())); // right at 100
    yield { type: "text", text: "x" };
  };
  const answers = [{ option: 0, confidence: 70 }, { option: 2, confidence: 50 }, { option: 1, confidence: 100 }];
  const events = await t.runClass({}, (q) => (q.phase === "predict" ? { text: "g" } : answers.shift()!));
  assert.equal(json(results[0]).sureAndWrong, true);
  assert.match(json(results[0]).next, /misconception/);
  assert.equal(json(results[1]).sureAndWrong, undefined);
  assert.equal(json(results[2]).sureAndWrong, undefined);
  const ev = await t.evidence(events.find((e) => e.type === "learner").classId);
  assert.deepEqual(ev.map((e) => e.sureAndWrong), [undefined, true, undefined, undefined]);
});

test("a free-text check is graded by a grader model call against the committed answer", async () => {
  const t = await newCore();
  const verdicts = [{ correct: false, feedback: "It misses that the work waits its turn." }, { correct: true, feedback: "Same idea." }];
  graderOut = () => ok(verdicts.shift());
  launches.length = 0;
  const results: any[] = [];
  const nextStep: any[] = [];
  teacher = async function* (call) {
    await teachTo(call);
    const q = { stepId: "s1", kind: "text", prompt: "Why put a queue before the worker?", expected: "So work waits its turn when a burst arrives" };
    results.push(await call("ask", q));
    nextStep.push(await call("begin_step", { stepId: "s2", title: "Next" }));
    await call("explain", { stepId: "s1", text: "Again." });
    results.push(await call("ask", q));
    nextStep.push(await call("begin_step", { stepId: "s2", title: "Next" }));
    yield { type: "text", text: "x" };
  };
  const answers = ["because it is fast", "so jobs line up during a rush"];
  const events = await t.runClass({}, (q) => (q.phase === "predict" ? { text: "g" } : { text: answers.shift()! }));
  assert.deepEqual([json(results[0]).correct, json(results[0]).stepClosed, json(results[0]).feedback], [false, false, "It misses that the work waits its turn."]);
  assert.equal(nextStep[0].isError, true);
  assert.deepEqual([json(results[1]).correct, json(results[1]).stepClosed], [true, true]);
  assert.equal(nextStep[1].isError, undefined);

  const g = launches.filter((l) => l.role === "grader");
  assert.equal(g.length, 2);
  assert.equal(g[0].model, "haiku");
  assert.equal(g[0].tools, undefined);
  assert.ok(g[0].schema && JSON.stringify(g[0].schema).includes("correct") && JSON.stringify(g[0].schema).includes("feedback"));
  assert.ok(g[0].instructions!.length < 1000, "short: it goes on the Windows command line");
  assert.ok(g[0].message.includes("So work waits its turn when a burst arrives") && g[0].message.includes("because it is fast"));
  const ev = await t.evidence(events.find((e) => e.type === "learner").classId);
  assert.deepEqual(ev.filter((e) => e.phase === "check").map((e) => [e.kind, e.correct, e.attempt]), [["text", false, 1], ["text", true, 2]]);
});

test("when the grader fails the answer is kept as Evidence, nothing is counted, and the Teacher is told", async () => {
  const t = await newCore();
  graderOut = () => [{ type: "error", code: "failed", message: "boom" }];
  let r: any, next: any;
  teacher = async function* (call) {
    await teachTo(call);
    r = await call("ask", { stepId: "s1", kind: "text", prompt: "Why?", expected: "Because" });
    next = await call("begin_step", { stepId: "s2", title: "Next" });
    yield { type: "text", text: "x" };
  };
  const events = await t.runClass({}, () => ({ text: "an answer" }));
  assert.equal(r.isError, true);
  assert.match(text(r), /grad/i);
  assert.equal(next.isError, true, "the step is still open");
  const ev = await t.evidence(events.find((e) => e.type === "learner").classId);
  assert.deepEqual(ev.filter((e) => e.phase === "check").map((e) => [e.answer, e.correct]), [["an answer", null]]);
});

test("the person ends the class mid-step and the pipeline still runs on what was taught", async () => {
  const t = await newCore();
  extractorOut = () => ok({ propositions: [{ name: "Queue absorbs bursts", statement: "A queue holds work.", aliases: [], message: 0 }], chains: [] });
  launches.length = 0;
  teacher = async function* (call) {
    await teachTo(call);
    await call("ask", choice()); // the person ends the class while this card is open
    yield { type: "text", text: "never said" };
  };
  await t.runClass({}, () => ({ text: "g" }), (e) => e.type === "tutor_question" && e.phase === "check");
  for (let i = 0; i < 50 && !(await t.get("/learner/graph")).propositions.length; i++) await new Promise((r) => setTimeout(r, 100));
  const ex = launches.find((l) => l.role === "extractor")!;
  assert.ok(ex.message.includes("The fact of s1."), "the explanation of the open step reached the Extractor");
  assert.ok(!ex.message.includes("never said"));
  assert.equal((await t.get("/learner/graph")).propositions.length, 1);
});

test("finish_class is refused while a step is open, and ends the class once the work is done", async () => {
  const t = await newCore();
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    seen.none = await call("finish_class", { summary: "x" });
    await teachTo(call);
    seen.open = await call("finish_class", { summary: "x" });
    await call("ask", choice());
    seen.noSummary = await call("finish_class", {});
    seen.done = await call("finish_class", { summary: "We covered what a queue is for." });
    seen.after = await call("begin_step", { stepId: "s2", title: "More" });
    yield { type: "text", text: "bye" };
  };
  const events = await t.runClass({}, (q) => (q.phase === "predict" ? { text: "g" } : { option: 1 }));
  assert.match(text(seen.none), /step/i);
  assert.match(text(seen.open), /s1/);
  assert.match(text(seen.noSummary), /summary/);
  assert.equal(seen.done.isError, undefined);
  assert.match(text(seen.after), /finished/);
  assert.deepEqual(events.find((e) => e.type === "tutor_finished"), { type: "tutor_finished", summary: "We covered what a queue is for." });
});

test("the class takes its topic from the start request, and the Teacher's instructions are short and name the loop", async () => {
  const t = await newCore();
  launches.length = 0;
  teacher = () => say("hi");
  assert.equal((await t.post("/tutor/classes", { project, topic: 7 })).status, 400);
  assert.equal((await t.post("/tutor/classes", { project, topic: "x".repeat(501) })).status, 400);
  await t.runClass({ topic: "message queues" });
  const opts = launches.find((l) => l.role === "tutor")!;
  assert.match(opts.message, /message queues/);
  assert.ok(opts.instructions!.length < 4000, `instructions are ${opts.instructions!.length} characters`);
  for (const word of ["begin_step", "predict", "explain", "ask", "finish_class"]) assert.ok(opts.instructions!.includes(word), word);
  assert.match(opts.instructions!, /Tutor of aidea/);
});

test("the Teacher's tool list carries the loop tools next to the read tools", async () => {
  const t = await newCore();
  let names: string[] = [];
  teacher = async function* () {
    const res = await fetch(JSON.parse(launches.at(-1)!.tools!.mcpConfig).mcpServers.tutor.url, { method: "POST", body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }), headers: { "content-type": "application/json" } });
    names = (await res.json()).result.tools.map((x: any) => x.name);
    yield { type: "text", text: "x" };
  };
  await t.runClass();
  assert.deepEqual(names, ["begin_step", "predict", "explain", "ask", "finish_class", "read_layers", "read_node", "list_files", "read_file", "read_recording"]);
});
