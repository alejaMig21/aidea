import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { TUTOR_TOOLS } from "../src/core/tutor.ts";
import { fixture } from "./helpers.ts";

// tutor-rewrite 05: practice, in a session of its own that the person or the Tutor can ask for: problems on ideas taught but not reliably recalled, hints one level at a time,
// a grader, and practical problems closed by a plugin's check. The Tutor never does the task, and the model solution is not shown before the answer.
type RunOptions = Parameters<Adapter["run"]>[0];
type Call = (name: string, args: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;
let tutor: (call: Call, opts: RunOptions) => AsyncGenerator<AgentEvent> = async function* () {};
const openings: string[] = [];
const fakeAgent: Adapter = {
  options: { modes: [], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    if (opts.role === "grader") { yield { type: "result", structured: { correct: /Person's answer: soup/.test(opts.message), feedback: "Graded." } } as AgentEvent; return; }
    if (opts.role !== "tutor") return;
    openings.push(opts.message);
    const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
    const rpc = async (method: string, params: unknown = {}) =>
      (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method, params }) })).json()).result;
    yield* tutor((name, args) => rpc("tools/call", { name, arguments: args }), opts);
  },
};

const scratch = mkdtempSync(join(tmpdir(), "aidea-practice-"));
const cores: Awaited<ReturnType<typeof startCore>>[] = [];
after(async () => { for (const c of cores) { await c.plugins.deactivate("canvas"); c.close(); } });
const project = fixture("shop");
const DAY = 86_400_000;
const prop = (name: string) => JSON.stringify({ op: "put", proposition: { id: name.toLowerCase().replaceAll(" ", "-"), name, statement: `${name} is an idea taught before.`, aliases: [], provenance: [{ classId: "c1", message: 0, project }] } }) + "\n";
const strong = (idea: string) => JSON.stringify({ classId: "c1", questionId: `q-${idea}`, project, kind: "choice", correct: true, confidence: 90, answer: "x", thought: null, dontKnow: false, time: new Date(Date.now() - DAY).toISOString(), phase: "check", idea }) + "\n";

let n = 0;
async function newCore(props: string[] = [prop("Queue"), prop("Worker")], rows: string[] = [strong("queue")]) {
  const learnerDir = mkdtempSync(join(scratch, "l"));
  writeFileSync(join(learnerDir, "propositions.jsonl"), props.join(""));
  if (rows.length) writeFileSync(join(learnerDir, "evidence.jsonl"), rows.join(""));
  const dir = join(scratch, `plug${n++}`, "canvas");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id: "canvas", version: "1.0.0", title: "Canvas", description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", teach: { view: "state", module: "teach.mjs", checks: [{ name: "has-relation", says: "A relation between two Nodes exists.", args: { from: "string", to: "string" } }] } }));
  writeFileSync(join(dir, "main.js"), "export function activate(ctx) { ctx.teach.state(() => ({ relations: [['shop', 'db']] })); }");
  writeFileSync(join(dir, "teach.mjs"), 'export const view = (s) => s;\nexport const checks = { "has-relation": (s, a) => { const f = s.relations.some(([x, y]) => x === a.from && y === a.to); return { ok: f, reason: f ? "The relation exists." : "There is no such relation." }; } };');
  const store = mkdtempSync(join(scratch, "store"));
  cpSync(dir, join(store, "canvas"), { recursive: true });
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir, pluginsDir: store, builtinPluginsDir: false, preferencesFile: join(learnerDir, "p.json") });
  cores.push(core);
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
  const post = (path: string, b: unknown = {}) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  const session = async (reply: (q: any) => Record<string, unknown>, body: Record<string, unknown> = { practice: true }) => {
    const res = await post("/tutor/classes", { project, ...body });
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
  const evidence = async () => ((await (await fetch(core.url + `/learner/evidence?project=${encodeURIComponent(project)}`)).json()) as any).entries as any[];
  return { core, session, evidence };
}
const text = (r: { content: { text: string }[] }) => r.content[0].text;
const choiceProblem = (over: Record<string, unknown> = {}) => ({ problemId: "p1", idea: "Worker", form: "recall", kind: "choice", prompt: "What does a worker do?", options: ["Takes jobs from the queue", "Draws the screen", "Stores passwords"], correct: "Takes jobs from the queue", solution: "A worker takes a job from the queue and runs it. SECRET-SOLUTION", rubric: "Mentions taking jobs.", ...over });
const answer = (q: any) => (q.kind === "choice" ? { option: 0, confidence: 70 } : q.kind === "task" ? { done: true } : { text: "soup" });

test("the person asks for practice: the session opens as practice, and the practice tools work only there", async () => {
  const t = await newCore();
  const seen: any = {};
  tutor = async function* (call) { seen.targets = await call("practice_targets", {}); yield { type: "text", text: "done" }; };
  openings.length = 0;
  await t.session(answer);
  assert.match(openings[0], /practice/i);
  assert.equal(seen.targets.isError, undefined, text(seen.targets));
  const free = await newCore();
  const other: any = {};
  tutor = async function* (call) { other.targets = await call("practice_targets", {}); other.problem = await call("problem", choiceProblem()); yield { type: "text", text: "done" }; };
  await free.session(answer, { message: "teach me" });
  assert.equal(other.targets.isError, true);
  assert.match(text(other.targets), /practice session/i);
  assert.equal(other.problem.isError, true);
});

test("the Tutor can offer practice, and only the person's yes starts it", async () => {
  const yes = await newCore();
  const seen: any = {};
  tutor = async function* (call) {
    seen.before = await call("practice_targets", {});
    seen.offer = JSON.parse(text(await call("offer_practice", { reason: "You have met two ideas and only one is solid." })));
    seen.after = await call("practice_targets", {});
    yield { type: "text", text: "done" };
  };
  const events = await yes.session((q) => (q.phase === "offer" ? { option: 0 } : answer(q)), { message: "hi" });
  const card = events.find((e) => e.type === "tutor_question" && e.phase === "offer");
  assert.deepEqual(card.options, ["Practice now", "Not now"]);
  assert.match(card.prompt, /two ideas/);
  assert.equal(seen.before.isError, true);
  assert.equal(seen.offer.accepted, true);
  assert.equal(seen.after.isError, undefined, text(seen.after));
  const no = await newCore();
  const refused: any = {};
  tutor = async function* (call) {
    refused.offer = JSON.parse(text(await call("offer_practice", { reason: "Practice?" })));
    refused.after = await call("practice_targets", {});
    yield { type: "text", text: "done" };
  };
  await no.session((q) => (q.phase === "offer" ? { option: 1 } : answer(q)), { message: "hi" });
  assert.equal(refused.offer.accepted, false);
  assert.equal(refused.after.isError, true);
});

test("practice_targets lists the ideas of this Project that were taught and are not reliably recalled; a problem about another idea is refused", async () => {
  const t = await newCore();
  const seen: any = {};
  tutor = async function* (call) {
    seen.targets = JSON.parse(text(await call("practice_targets", {})));
    seen.solid = await call("problem", choiceProblem({ idea: "Queue" }));
    seen.unknown = await call("problem", choiceProblem({ idea: "Sharding" }));
    yield { type: "text", text: "done" };
  };
  await t.session(answer);
  assert.deepEqual(seen.targets.ideas.map((i: any) => i.name), ["Worker"], "Queue has strong Evidence, so it is solid");
  assert.equal(seen.solid.isError, true);
  assert.match(text(seen.solid), /worker/);
  assert.equal(seen.unknown.isError, true);
});

test("a problem is shown without its solution or rubric; the solution is revealed to the Tutor only after the answer; the answer is Evidence of phase practice", async () => {
  const t = await newCore();
  const seen: any = {};
  tutor = async function* (call) {
    await call("practice_targets", {});
    seen.right = JSON.parse(text(await call("problem", choiceProblem())));
    seen.again = await call("problem", choiceProblem());
    yield { type: "text", text: "done" };
  };
  const events = await t.session(answer);
  const shown = JSON.stringify(events.filter((e) => e.type === "tutor_question"));
  assert.doesNotMatch(shown, /SECRET-SOLUTION|Mentions taking jobs/);
  const card = events.find((e) => e.type === "tutor_question" && e.phase === "practice");
  assert.deepEqual(card.hints, { n: 0, of: 6 });
  assert.equal(seen.right.correct, true);
  assert.match(seen.right.solution, /SECRET-SOLUTION/);
  assert.equal(seen.again.isError, true, "a problem id is used once");
  const entry = (await t.evidence()).find((e) => e.phase === "practice");
  assert.ok(entry);
  assert.deepEqual([entry.idea, entry.correct, entry.confidence], ["worker", true, 70]);
});

test("a written problem is graded against the solution and the rubric", async () => {
  const t = await newCore();
  const seen: any = {};
  tutor = async function* (call) {
    await call("practice_targets", {});
    seen.text = JSON.parse(text(await call("problem", { problemId: "t1", idea: "Worker", form: "composition", kind: "text", prompt: "Explain what a worker does.", solution: "It takes jobs and runs them, like soup from a pot.", rubric: "Mentions soup." })));
    yield { type: "text", text: "done" };
  };
  await t.session(answer);
  assert.equal(seen.text.correct, true);
});

test("hints come one level per request from the person, in order, at most six; the Tutor cannot give one that was not asked for", async () => {
  const t = await newCore();
  const seen: any = { levels: [] };
  tutor = async function* (call) {
    await call("practice_targets", {});
    seen.unasked = await call("hint", { problemId: "p1", text: "Think about queues." });
    const first = JSON.parse(text(await call("problem", choiceProblem())));
    seen.first = first;
    let r: any = first;
    while (r.hintRequested) { seen.levels.push(r.level); r = JSON.parse(text(await call("hint", { problemId: "p1", text: `Hint number ${r.level}` }))); }
    seen.last = r;
    yield { type: "text", text: "done" };
  };
  let asked = 0;
  const events = await t.session((q) => (q.phase === "practice" && ++asked <= 2 ? { hint: true } : answer(q)));
  assert.equal(seen.unasked.isError, true);
  assert.equal(seen.first.hintRequested, true);
  assert.deepEqual([seen.first.level, seen.first.of], [1, 6]);
  assert.deepEqual(events.filter((e) => e.type === "tutor_hint").map((e) => [e.level, e.text]), [[1, "Hint number 1"], [2, "Hint number 2"]]);
  assert.equal(seen.last.correct, true, "after two hints the person answered");
  assert.equal(seen.last.hintsUsed, 2);
  const cards = events.filter((e) => e.type === "tutor_question" && e.phase === "practice");
  assert.deepEqual(cards.map((c) => c.hints.n), [0, 1, 2]);
});

test("a practical problem is closed only by a plugin check, and the Tutor has no tool that does the task", async () => {
  const t = await newCore();
  const seen: any = {};
  const task = (id: string, from: string, to: string) => ({ problemId: id, idea: "Worker", form: "composition", kind: "task", prompt: `Draw a relation from ${from} to ${to}.`, plugin: "canvas", check: "has-relation", args: { from, to }, solution: "Link shop to db.", rubric: "The relation exists." });
  tutor = async function* (call) {
    await call("practice_targets", {});
    seen.fail = JSON.parse(text(await call("problem", task("k1", "db", "shop"))));
    seen.pass = JSON.parse(text(await call("problem", task("k2", "shop", "db"))));
    yield { type: "text", text: "done" };
  };
  await t.session(answer);
  assert.equal(seen.fail.correct, false);
  assert.equal(seen.pass.correct, true);
  assert.equal(seen.pass.untrusted, true);
  const names = TUTOR_TOOLS.map((x: any) => x.name);
  assert.deepEqual(names.filter((x) => /^(draw|do_task|perform|complete_task|solve)/.test(x)), []);
  const entries = (await t.evidence()).filter((e) => e.phase === "practice" && e.kind === "task");
  assert.deepEqual(entries.map((e) => [e.correct, e.check.name]), [[false, "has-relation"], [true, "has-relation"]]);
});

test("an empty list of targets says so, and finish_class works without any step", async () => {
  const t = await newCore([], []);
  const seen: any = {};
  tutor = async function* (call) {
    seen.targets = JSON.parse(text(await call("practice_targets", {})));
    seen.finish = await call("finish_class", { summary: "Nothing to practise yet." });
    yield { type: "text", text: "done" };
  };
  await t.session(answer);
  assert.deepEqual(seen.targets.ideas, []);
  assert.match(seen.targets.note, /nothing/i);
  assert.equal(seen.finish.isError, undefined, text(seen.finish));
});
