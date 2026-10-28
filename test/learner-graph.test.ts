import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, isAbsolute } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { mergeGraph } from "../src/core/learner-pipeline.ts";
import { fixture } from "./helpers.ts";

type RunOptions = Parameters<Adapter["run"]>[0];

// A stand-in for Claude Code: the Tutor role says fixed prose and may ask; the Extractor and Auditor roles return scripted data.
let teacher: (call: (name: string, args: unknown) => Promise<any>) => AsyncGenerator<AgentEvent> = async function* () {};
let extractorOut: () => AgentEvent[] = () => [];
let auditorOut: () => AgentEvent[] = () => [];
const launches: RunOptions[] = [];
const ok = (structured: unknown): AgentEvent[] => [{ type: "result", text: "", structured, usage: {} }];
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    launches.push(opts);
    if (opts.role === "extractor") return yield* extractorOut();
    if (opts.role === "auditor") return yield* auditorOut();
    if (opts.role === "grader") return yield* ok({ correct: true, feedback: "ok" });
    if (opts.role !== "tutor") return;
    const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
    const call = async (name: string, args: unknown) =>
      (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) })).json()).result;
    yield* teacher(call);
  },
};

const project = fixture("shop");
const cores: Awaited<ReturnType<typeof startCore>>[] = [];
async function newCore(dir = mkdtempSync(join(tmpdir(), "aidea-learner-"))) {
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: dir });
  cores.push(core);
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
  const post = (path: string, body: unknown = {}) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const get = async (path: string) => (await fetch(core.url + path)).json() as Promise<any>;
  // Runs a class to its end, answering each question in turn, and returns every event.
  const runClass = async (body: Record<string, unknown> = {}, answers: Record<string, unknown>[] = []) => {
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
        if (e.type === "tutor_question") await post("/tutor/answer", { id: e.id, secret: e.secret, ...answers.shift() });
      }
    }
    return out;
  };
  return { core, dir, post, get, runClass };
}
after(() => cores.forEach((c) => c.close()));

// begin_step, predict, explain: what the core demands before a check.
const prelude = async (call: (name: string, args: unknown) => Promise<any>, stepId = "s1") => {
  await call("begin_step", { stepId, title: "A step" });
  await call("predict", { stepId, prompt: "Guess?" });
  await call("explain", { stepId, text: "A queue holds work." });
};
const say = (...texts: string[]) => async function* () { for (const text of texts) yield { type: "text", text } as AgentEvent; };
const prop = (name: string, statement: string, message = 0, aliases: string[] = []) => ({ name, statement, aliases, message });
const files = (dir: string) => Object.fromEntries(["evidence.jsonl", "propositions.jsonl", "chains.jsonl"].map((f) => [f, existsSync(join(dir, f)) ? readFileSync(join(dir, f), "utf8") : null]));

const QUEUE = prop("Queue absorbs bursts", "A queue holds work so a burst does not overload the worker.", 0);
const IDEMP = prop("Idempotent consumers", "A consumer that can see a message twice must give the same result.", 1);
const EXPECTED_CHAIN = { premises: ["Queue absorbs bursts"], conclusion: "Idempotent consumers", message: 1 };

test("fixed Teacher prose and fixed extractor output give exactly the expected graph", async () => {
  const t = await newCore();
  teacher = say("A queue holds work.", "Consumers may see a message twice.");
  extractorOut = () => ok({ propositions: [QUEUE, IDEMP], chains: [EXPECTED_CHAIN] });
  auditorOut = () => ok({ links: [] });
  launches.length = 0;
  const events = await t.runClass({ node: "n-orders" });
  const learner = events.at(-1);
  assert.equal(learner.type, "learner");
  assert.equal(learner.status, "saved");
  assert.equal(learner.ideas, 2);
  assert.match(learner.classId, /^c-/);

  const ex = launches.find((l) => l.role === "extractor")!;
  assert.equal(ex.model, "haiku");
  assert.ok(ex.message.includes("A queue holds work.") && ex.message.includes("Consumers may see a message twice."));
  assert.ok(ex.instructions!.length < 1500, "kept short: on Windows it goes on the command line");
  assert.ok(ex.schema, "the Extractor's output is constrained by a schema");
  assert.ok(launches.find((l) => l.role === "auditor"));

  const graph = await t.get("/learner/graph");
  const prov = (message: number) => [{ classId: learner.classId, message, node: "n-orders" }];
  assert.deepEqual(graph.propositions, [
    { id: "queue-absorbs-bursts", name: "Queue absorbs bursts", statement: QUEUE.statement, aliases: [], provenance: prov(0) },
    { id: "idempotent-consumers", name: "Idempotent consumers", statement: IDEMP.statement, aliases: [], provenance: prov(1) },
  ]);
  assert.equal(graph.chains.length, 1);
  assert.match(graph.chains[0].id, /^ch-[0-9a-f]{12}$/);
  assert.deepEqual({ ...graph.chains[0], id: undefined }, { id: undefined, premises: ["queue-absorbs-bursts"], conclusion: "idempotent-consumers", provenance: prov(1) });
});

test("a second class with the same ideas leaves one copy of each and adds provenance", async () => {
  const t = await newCore();
  teacher = say("A queue holds work.", "Consumers may see a message twice.");
  extractorOut = () => ok({ propositions: [QUEUE, IDEMP], chains: [EXPECTED_CHAIN] });
  auditorOut = () => ok({ links: [] });
  const first = (await t.runClass()).at(-1);
  const second = (await t.runClass()).at(-1);
  const graph = await t.get("/learner/graph");
  assert.equal(graph.propositions.length, 2);
  assert.equal(graph.chains.length, 1);
  assert.deepEqual(graph.propositions[0].provenance.map((p: any) => p.classId), [first.classId, second.classId]);
});

test("merging the same input twice gives the same graph", () => {
  const input = { classId: "c-1", propositions: [QUEUE, IDEMP, prop("queue  absorbs bursts", "again", 1)], chains: [EXPECTED_CHAIN] };
  const once = mergeGraph({ propositions: [], chains: [] }, input, []);
  assert.equal(once.propositions.length, 2);
  assert.deepEqual(mergeGraph(once, input, []), once);
});

test("two names that normalise equal merge and keep both aliases and both provenances", async () => {
  const t = await newCore();
  teacher = say("one", "two");
  extractorOut = () => ok({ propositions: [prop("Queue  absorbs bursts!", "First wording.", 0), prop("queue absorbs bursts", "Second wording.", 1)], chains: [] });
  auditorOut = () => ok({ links: [] });
  const learner = (await t.runClass()).at(-1);
  const { propositions } = await t.get("/learner/graph");
  assert.equal(propositions.length, 1);
  assert.equal(propositions[0].id, "queue-absorbs-bursts");
  assert.equal(propositions[0].name, "Queue  absorbs bursts!", "first seen is the canonical name");
  assert.deepEqual(propositions[0].aliases, ["queue absorbs bursts"]);
  assert.deepEqual(propositions[0].provenance.map((p: any) => [p.classId, p.message]), [[learner.classId, 0], [learner.classId, 1]]);
});

test("an auditor link merges two different names; the merger, not the auditor, picks the canonical name", async () => {
  const t = await newCore();
  teacher = say("one", "two");
  extractorOut = () => ok({ propositions: [prop("Dead letter queue", "Holds messages that keep failing.", 0), prop("DLQ", "A queue for failed messages.", 1)], chains: [{ premises: ["DLQ"], conclusion: "Dead letter queue", message: 1 }] });
  auditorOut = () => ok({ links: [{ names: ["DLQ", "Dead letter queue"] }] }); // the auditor lists the other one first
  await t.runClass();
  const { propositions } = await t.get("/learner/graph");
  assert.equal(propositions.length, 1);
  assert.equal(propositions[0].name, "Dead letter queue");
  assert.deepEqual(propositions[0].aliases, ["DLQ"]);
  assert.equal(propositions[0].provenance.length, 2);
});

test("the auditor also sees ideas already in the graph", async () => {
  const t = await newCore();
  teacher = say("one");
  extractorOut = () => ok({ propositions: [prop("Dead letter queue", "Holds failing messages.", 0)], chains: [] });
  auditorOut = () => ok({ links: [] });
  await t.runClass();
  extractorOut = () => ok({ propositions: [prop("DLQ", "Failed messages go here.", 0)], chains: [] });
  let seen = "";
  auditorOut = () => { seen = launches.at(-1)!.message; return ok({ links: [{ names: ["DLQ", "Dead letter queue"] }] }); };
  await t.runClass();
  assert.match(seen, /Dead letter queue/);
  const { propositions } = await t.get("/learner/graph");
  assert.equal(propositions.length, 1);
  assert.equal(propositions[0].name, "Dead letter queue");
  assert.deepEqual(propositions[0].aliases, ["DLQ"]);
  assert.equal(propositions[0].provenance.length, 2);
});

test("a chain with a dangling reference is dropped", async () => {
  const t = await newCore();
  teacher = say("one", "two");
  extractorOut = () => ok({ propositions: [QUEUE, IDEMP], chains: [EXPECTED_CHAIN, { premises: ["Queue absorbs bursts", "Nothing like this"], conclusion: "Idempotent consumers", message: 1 }] });
  auditorOut = () => ok({ links: [] });
  await t.runClass();
  assert.equal((await t.get("/learner/graph")).chains.length, 1);
});

test("evidence is written for correct, wrong and don't-know answers, and never enters the graph", async () => {
  const t = await newCore();
  const choice = { stepId: "s1", kind: "choice", prompt: "Which one stores the data?", options: ["Queue", "Database", "Cache"], correct: "Database" };
  teacher = async function* (call) {
    await prelude(call);
    await call("ask", choice); // wrong
    await call("explain", { stepId: "s1", text: "Again." });
    await call("ask", choice); // don't know
    await call("explain", { stepId: "s1", text: "Again, differently." });
    await call("ask", choice); // right
    await prelude(call, "s2");
    await call("ask", { stepId: "s2", kind: "text", prompt: "Why a queue?", expected: "to smooth load" });
  };
  extractorOut = () => ok({ propositions: [QUEUE], chains: [] });
  auditorOut = () => ok({ links: [] });
  const events = await t.runClass({}, [
    { text: "a guess" },
    { option: 0 },
    { dontKnow: true, thought: "no idea" },
    { option: 1, confidence: 70, thought: "persists" },
    { text: "a guess" },
    { text: "to smooth load SECRETWORDS" },
  ]);
  const classId = events.at(-1).classId;
  const all = (await t.get(`/learner/evidence?project=${encodeURIComponent(project)}&class=${classId}`)).entries;
  const entries = all.filter((e: any) => e.phase === "check");
  assert.equal(all.length, 6);
  assert.equal(entries.length, 4);
  assert.deepEqual(entries.map((e: any) => [e.kind, e.correct, e.dontKnow]), [["choice", false, false], ["choice", null, true], ["choice", true, false], ["text", true, false]]);
  assert.deepEqual([entries[2].confidence, entries[2].answer, entries[2].thought], [70, "Database", "persists"]);
  assert.deepEqual([entries[0].confidence, entries[0].answer], [50, "Queue"]);
  assert.deepEqual([entries[1].answer, entries[1].thought], [null, "no idea"]);
  assert.equal(entries[3].answer, "to smooth load SECRETWORDS");
  for (const e of all) {
    assert.equal(e.classId, classId);
    assert.equal(e.project, project);
    assert.match(e.questionId, /^q-/);
    assert.ok(!Number.isNaN(Date.parse(e.time)));
  }
  assert.equal((await t.get("/learner/evidence?class=other")).entries.length, 0);
  assert.equal((await t.get("/learner/evidence?project=elsewhere")).entries.length, 0);
  assert.ok(!JSON.stringify(await t.get("/learner/graph")).includes("SECRETWORDS"));
  assert.ok(!files(t.dir)["propositions.jsonl"]!.includes("SECRETWORDS"));
});

test("an answer is recorded even when the class then fails", async () => {
  const t = await newCore();
  teacher = async function* (call) { await prelude(call); await call("ask", { stepId: "s1", kind: "text", prompt: "Why?", expected: "because" }); yield { type: "text", text: "x" }; };
  extractorOut = () => [{ type: "error", code: "failed", message: "boom" }];
  const events = await t.runClass({}, [{ text: "g" }, { text: "because" }]);
  assert.equal(events.at(-1).status, "failed");
  assert.equal((await t.get("/learner/evidence")).entries.length, 2);
});

test("deleting an idea removes it and the chains that use it, nothing else; there is no edit route", async () => {
  const t = await newCore();
  teacher = say("one", "two");
  extractorOut = () => ok({
    propositions: [QUEUE, IDEMP, prop("Retries", "Failed work is tried again.", 1)],
    chains: [EXPECTED_CHAIN, { premises: ["Retries"], conclusion: "Idempotent consumers", message: 1 }, { premises: ["Queue absorbs bursts"], conclusion: "Retries", message: 1 }],
  });
  auditorOut = () => ok({ links: [] });
  await t.runClass();
  assert.equal((await t.get("/learner/graph")).chains.length, 3);
  const del = await fetch(t.core.url + "/learner/propositions/queue-absorbs-bursts", { method: "DELETE" });
  assert.equal(del.status, 200);
  const g = await t.get("/learner/graph");
  assert.deepEqual(g.propositions.map((p: any) => p.id), ["retries", "idempotent-consumers"]);
  assert.equal(g.chains.length, 1);
  assert.deepEqual([g.chains[0].premises, g.chains[0].conclusion], [["retries"], "idempotent-consumers"]);
  assert.equal((await fetch(t.core.url + "/learner/propositions/queue-absorbs-bursts", { method: "DELETE" })).status, 404);
  for (const method of ["PUT", "PATCH", "POST"]) {
    assert.equal((await fetch(t.core.url + "/learner/propositions/retries", { method, headers: { "content-type": "application/json" }, body: "{}" })).status, 404);
  }
  // The deletion survives a restart.
  const again = await newCore(t.dir);
  assert.deepEqual((await again.get("/learner/graph")).propositions.map((p: any) => p.id), ["retries", "idempotent-consumers"]);
  assert.equal((await again.get("/learner/graph")).chains.length, 1);
});

test("a failing Extractor or Auditor, or invalid data, leaves every file as it was and the class can be retried", async () => {
  const t = await newCore();
  teacher = say("first class");
  extractorOut = () => ok({ propositions: [QUEUE], chains: [] });
  auditorOut = () => ok({ links: [] });
  await t.runClass();
  const snapshot = files(t.dir);

  const failures: [string, () => void][] = [
    ["extractor error", () => { extractorOut = () => [{ type: "error", code: "failed", message: "boom" }]; }],
    ["extractor invalid", () => { extractorOut = () => ok({ propositions: [{ name: "", statement: 3 }], chains: [] }); }],
    ["extractor no output", () => { extractorOut = () => [{ type: "result", text: "plain text", usage: {} }]; }],
    ["auditor error", () => { extractorOut = () => ok({ propositions: [{ ...IDEMP, message: 0 }, prop("Other", "x", 0)], chains: [] }); auditorOut = () => [{ type: "error", code: "failed", message: "boom" }]; }],
    ["auditor invalid", () => { auditorOut = () => ok({ links: "nope" }); }],
  ];
  teacher = say("second class");
  let classId = "";
  for (const [label, arrange] of failures) {
    arrange();
    const ev = (await t.runClass()).at(-1);
    assert.equal(ev.status, "failed", label);
    assert.match(ev.message, /pipeline failed/i, label);
    assert.deepEqual(files(t.dir), snapshot, `${label}: files byte-identical`);
    classId = ev.classId;
  }

  // The last failed class is retryable, also after a restart.
  extractorOut = () => ok({ propositions: [{ ...IDEMP, message: 0 }], chains: [] });
  auditorOut = () => ok({ links: [] });
  const again = await newCore(t.dir);
  const retry = await again.post(`/tutor/classes/${classId}/close`);
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), { ok: true, ideas: 1 });
  assert.deepEqual((await again.get("/learner/graph")).propositions.map((p: any) => p.id), ["queue-absorbs-bursts", "idempotent-consumers"]);
  assert.equal((await again.post(`/tutor/classes/${classId}/close`)).status, 404, "a closed class has nothing left to retry");
  assert.equal((await again.post("/tutor/classes/c-nope/close")).status, 404);
});

test("a failed retry answers 502 and keeps the class", async () => {
  const t = await newCore();
  teacher = say("x");
  extractorOut = () => [{ type: "error", code: "failed", message: "boom" }];
  const ev = (await t.runClass()).at(-1);
  const bad = await t.post(`/tutor/classes/${ev.classId}/close`);
  assert.equal(bad.status, 502);
  extractorOut = () => ok({ propositions: [QUEUE], chains: [] });
  auditorOut = () => ok({ links: [] });
  assert.equal((await t.post(`/tutor/classes/${ev.classId}/close`)).status, 200);
});

test("a class where the Teacher said nothing has nothing to extract and closes without calling the roles", async () => {
  const t = await newCore();
  teacher = async function* () {};
  launches.length = 0;
  const events = await t.runClass();
  assert.ok(!events.some((e) => e.type === "learner"), "nothing was said, so nothing to report");
  assert.ok(!launches.some((l) => l.role === "extractor"));
});

test("the stores survive a core restart and live outside the Project", async () => {
  const t = await newCore();
  teacher = async function* (call) { await prelude(call); await call("ask", { stepId: "s1", kind: "text", prompt: "Why?", expected: "because" }); await prelude(call, "s2"); };
  extractorOut = () => ok({ propositions: [QUEUE, IDEMP], chains: [EXPECTED_CHAIN] });
  auditorOut = () => ok({ links: [] });
  await t.runClass({}, [{ text: "g" }, { text: "because" }, { text: "g" }]);
  const graph = await t.get("/learner/graph");
  const evidence = await t.get("/learner/evidence");
  const again = await newCore(t.dir);
  assert.deepEqual(await again.get("/learner/graph"), graph);
  assert.deepEqual(await again.get("/learner/evidence"), evidence);
  const rel = relative(project, t.dir);
  assert.ok(rel.startsWith("..") || isAbsolute(rel), "the folder is not inside the Project");
  assert.ok(!readdirSync(project).some((f) => /jsonl|learner/.test(f)));
  for (const f of ["evidence.jsonl", "propositions.jsonl", "chains.jsonl"]) assert.ok(existsSync(join(t.dir, f)), f);
});

test("the Claude adapter launches the Extractor with no tools, a schema, and reads structured_output", async () => {
  const { EventEmitter } = await import("node:events");
  const { PassThrough } = await import("node:stream");
  const { createClaudeAdapter } = await import("../src/core/adapter/claude.ts");
  const seen: string[][] = [];
  const line = JSON.stringify({ type: "result", is_error: false, result: "", structured_output: { ok: 1 }, usage: {} });
  const spawnFn: any = (args: string[]) => {
    seen.push(args);
    const child = new EventEmitter() as any;
    child.stdout = new PassThrough(); child.stderr = new PassThrough(); child.stdin = new PassThrough(); child.kill = () => {};
    setImmediate(() => { child.stdout.end(line + "\n"); child.stderr.end(); child.emit("close", 0); });
    return child;
  };
  const out: AgentEvent[] = [];
  for await (const e of createClaudeAdapter(spawnFn).run({ cwd: ".", message: "prose", role: "extractor", model: "haiku", instructions: "RULES", schema: { type: "object" } })) out.push(e);
  const args = seen[0];
  const after = (f: string) => args[args.indexOf(f) + 1];
  assert.equal(after("--system-prompt"), "RULES");
  assert.equal(after("--json-schema"), JSON.stringify({ type: "object" }));
  assert.equal(after("--tools"), "");
  assert.equal(after("--model"), "haiku");
  for (const f of ["--strict-mcp-config", "--no-session-persistence", "--disable-slash-commands"]) assert.ok(args.includes(f), f);
  for (const f of ["--mcp-config", "--allowedTools", "--resume"]) assert.ok(!args.includes(f), f);
  assert.deepEqual((out[0] as any).structured, { ok: 1 });
});
