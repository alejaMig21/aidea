import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

type Call = (name: string, args: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;

// A stand-in for Claude Code: the Teacher is a script over the core's MCP tools.
let teacher: (call: Call) => AsyncGenerator<AgentEvent> = async function* () {};
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
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
const DAY = 86_400_000;
const prop = (name: string, aliases: string[] = []) =>
  JSON.stringify({ op: "put", proposition: { id: name.toLowerCase().replaceAll(" ", "-"), name, statement: `${name} is an idea taught before.`, aliases, provenance: [{ classId: "c1", message: 0, project }] } }) + "\n";
// One Evidence row about an idea: a review answer. `ago` is how old it is in days.
const row = (idea: string, o: { correct?: boolean | null; confidence?: number | null; ago?: number; project?: string } = {}) =>
  JSON.stringify({ classId: "c1", questionId: `q-${idea}`, project: o.project ?? project, kind: "choice", correct: "correct" in o ? o.correct : true, confidence: o.confidence ?? 90, answer: "SECRET ANSWER", thought: null, dontKnow: false, time: new Date(Date.now() - (o.ago ?? 1) * DAY).toISOString(), phase: "review", idea }) + "\n";

async function newCore(props: string[], rows: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), "aidea-held-"));
  if (props.length) writeFileSync(join(dir, "propositions.jsonl"), props.join(""));
  if (rows.length) writeFileSync(join(dir, "evidence.jsonl"), rows.join(""));
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: dir, preferencesFile: join(dir, "preferences.json") });
  cores.push(core);
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
  await fetch(core.url + "/agent-options", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, reviewQuestion: false }) }); // no review question in the way
  const runClass = async () => {
    const res = await fetch(core.url + "/tutor/classes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project, topic: "queue" }) });
    let buf = "";
    for await (const chunk of res.body as any) {
      buf += Buffer.from(chunk).toString();
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const line of lines.filter(Boolean)) {
        const e = JSON.parse(line);
        // every question is answered: a guess, and the right option of a check
        if (e.type === "tutor_question") await fetch(core.url + "/tutor/answer", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: e.id, secret: e.secret, ...(e.kind === "choice" ? { option: 0, confidence: 50 } : { text: "a guess" }) }) });
      }
    }
  };
  return { runClass };
}
after(() => cores.forEach((c) => c.close()));

const text = (r: { content: { text: string }[] }) => r.content[0].text;

test("a step about an idea held with strong Evidence is refused with a reason, and a different step is accepted", async () => {
  const t = await newCore([prop("Queue")], [row("queue")]);
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    seen.held = await call("begin_step", { stepId: "s1", title: "Queues", idea: "queue" });
    seen.other = await call("begin_step", { stepId: "s1", title: "Workers", idea: "Worker" });
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  assert.equal(seen.held.isError, true);
  assert.match(text(seen.held), /Queue/);
  assert.match(text(seen.held), /already/i);
  assert.match(text(seen.held), /different|another|other/i, "it says what to do instead");
  assert.equal(seen.other.isError, undefined);
});

test("an alias of a held idea is refused too, and so is the Plan item the step names", async () => {
  const t = await newCore([prop("Worker", ["job runner"])], [row("worker")]);
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    seen.alias = await call("begin_step", { stepId: "s1", title: "Runners", idea: "Job Runner" });
    await call("set_plan", { concepts: [{ name: "Worker", dependsOn: [] }, { name: "Retry", dependsOn: ["Worker"] }] });
    seen.item = await call("begin_step", { stepId: "s2", title: "Workers", item: "Worker" });
    seen.fresh = await call("begin_step", { stepId: "s3", title: "Retries", item: "Retry" });
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  assert.equal(seen.alias.isError, true);
  assert.equal(seen.item.isError, true);
  assert.equal(seen.fresh.isError, undefined);
});

test("an idea with weak or old Evidence, or none, is still taught", async () => {
  const props = ["Wrong answer", "Unsure", "Old", "No evidence", "Other project", "Not graded"].map((n) => prop(n));
  const rows = [
    row("wrong answer", { correct: false }),
    row("unsure", { confidence: 30 }),
    row("old", { ago: 400 }),
    row("other project", { project: "C:/somewhere/else" }),
    row("not graded", { correct: null }),
  ];
  const t = await newCore(props, rows);
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    for (const [i, idea] of ["Wrong answer", "Unsure", "Old", "No evidence", "Other project", "Not graded"].entries()) {
      seen[idea] = await call("begin_step", { stepId: `s${i}`, title: idea, idea });
      if (seen[idea].isError) continue;
      // close the step so the next begin_step is not refused for an open step
      await call("predict", { stepId: `s${i}`, prompt: "guess" });
      await call("explain", { stepId: `s${i}`, text: "fact" });
      await call("ask", { stepId: `s${i}`, kind: "choice", prompt: "p", options: ["a", "b"], correct: "a" });
    }
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  for (const idea of ["Wrong answer", "Unsure", "Old", "No evidence", "Other project", "Not graded"]) assert.equal(seen[idea]?.isError, undefined, `${idea}: ${seen[idea] && text(seen[idea])}`);
});

test("with an empty graph nothing changes: any step begins, with or without an idea", async () => {
  const t = await newCore([]);
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    seen.held = await call("held_ideas", {});
    seen.begin = await call("begin_step", { stepId: "s1", title: "Queues", idea: "queue" });
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  assert.deepEqual(JSON.parse(text(seen.held)).ideas, []);
  assert.equal(seen.begin.isError, undefined);
});

test("held_ideas gives the Teacher the held ideas only, never the person's answers", async () => {
  const t = await newCore([prop("Queue"), prop("Worker")], [row("queue")]);
  let held: any;
  teacher = async function* (call) {
    held = await call("held_ideas", {});
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  assert.deepEqual(JSON.parse(text(held)).ideas.map((i: any) => i.name), ["Queue"], "Worker has no Evidence, so it is not held");
  assert.doesNotMatch(text(held), /SECRET ANSWER/);
  assert.deepEqual(Object.keys(JSON.parse(text(held)).ideas[0]).sort(), ["name", "statement"]);
});

test("a Plan whose every open concept is held does not trap the class: the last held concept is allowed, and the Teacher is told why", async () => {
  const t = await newCore([prop("Worker")], [row("worker")]);
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    await call("set_plan", { concepts: [{ name: "Worker", dependsOn: [] }] });
    seen.only = await call("begin_step", { stepId: "s1", title: "Workers", item: "Worker" });
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  assert.equal(seen.only.isError, undefined, text(seen.only));
  assert.match(text(seen.only), /already understands|held/i, "the Teacher is told the concept is held");
});

test("a held Plan concept is still refused while another Plan concept is not held", async () => {
  const t = await newCore([prop("Worker")], [row("worker")]);
  const seen: Record<string, any> = {};
  teacher = async function* (call) {
    await call("set_plan", { concepts: [{ name: "Worker", dependsOn: [] }, { name: "Retry", dependsOn: [] }] });
    seen.held = await call("begin_step", { stepId: "s1", title: "Workers", item: "Worker" });
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  assert.equal(seen.held.isError, true);
});
