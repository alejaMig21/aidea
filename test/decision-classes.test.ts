import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

type Call = (name: string, args?: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;
type Script = (call: Call, listTools: () => Promise<string[]>) => AsyncGenerator<AgentEvent>;

// A stand-in for Claude Code in both roles: the builder and the Tutor are scripts over the core's MCP tools.
let builder: Script = async function* () {};
let tutor: Script = async function* () {};
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    if (opts.role !== "tutor" && !opts.permission) return;
    const url = opts.role === "tutor" ? (JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string) : (JSON.parse(opts.permission!.mcpConfig).mcpServers.aidea.url as string);
    const rpc = async (method: string, params: unknown) =>
      (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method, params }) })).json()).result;
    const call: Call = (name, args = {}) => rpc("tools/call", { name, arguments: args });
    const listTools = async () => (await rpc("tools/list", {})).tools.map((t: { name: string }) => t.name) as string[];
    yield* (opts.role === "tutor" ? tutor : builder)(call, listTools);
  },
};

const scratch: string[] = [];
const cores: Awaited<ReturnType<typeof startCore>>[] = [];
after(() => {
  cores.forEach((c) => c.close());
  scratch.forEach((d) => rmSync(d, { recursive: true, force: true }));
});

async function setup(prefsFile?: string, learnerDir?: string) {
  const core = await startCore({ port: 0, adapter: fakeAgent, preferencesFile: prefsFile, learnerDir });
  cores.push(core);
  const dir = mkdtempSync(join(tmpdir(), "aidea-decision-"));
  scratch.push(dir);
  cpSync(fixture("studio"), dir, { recursive: true });
  const post = (path: string, body: unknown = {}, signal?: AbortSignal) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  const get = async (path: string) => (await fetch(core.url + path)).json() as Promise<any>;
  await post("/projects", { path: dir });
  const setMode = (classMode: string) => post("/agent-options", { project: dir, classMode });
  const ndjson = async (res: Response, onEvent?: (e: any) => Promise<void> | void) => {
    const out: any[] = [];
    let buf = "";
    for await (const chunk of res.body as any) {
      buf += Buffer.from(chunk).toString();
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const l of lines) if (l) { const e = JSON.parse(l); out.push(e); await onEvent?.(e); }
    }
    return out;
  };
  // One builder conversation; returns what the interface streamed.
  const build = async (script: Script) => {
    builder = script;
    return ndjson(await post("/chat", { project: dir, message: "go" }));
  };
  // A decision class for a held Proposal; answers each question with `reply`.
  const classFor = async (decision: string, reply: (q: any) => Record<string, unknown> = () => ({ text: "I would pick Redis because reads dominate." })) => {
    const res = await post("/tutor/classes", { project: dir, decision });
    if (res.status !== 200) return { status: res.status, body: await res.json() as any, events: [] as any[] };
    const events = await ndjson(res, async (e) => { if (e.type === "tutor_question") await post("/tutor/answer", { id: e.id, secret: e.secret, ...reply(e) }); });
    return { status: 200, body: null, events };
  };
  const proposals = async () => (await get(`/proposals?project=${encodeURIComponent(dir)}`)).proposals as any[];
  const decide = (p: any, decision: string) => post("/proposals/answer", { id: p.id, secret: p.secret, decision });
  const architecture = () => JSON.parse(readFileSync(join(dir, ".aidea", "architecture.json"), "utf8")).nodes as any[];
  return { core, dir, post, get, setMode, build, classFor, proposals, decide, architecture };
}

const cache = { id: "cache", title: "Cache", technology: "Redis", rationale: { why: "Quotes are read far more than written.", rejected: [{ option: "No cache", reason: "The database is hit on every page." }] } };
const addCache: Script = async function* (call) { yield { type: "text", text: (await call("propose_add_node", { layer: "architecture", node: cache })).content[0].text }; };
const text = (r: { content: { text: string }[] }) => r.content[0].text;
const json = (r: { content: { text: string }[] }) => JSON.parse(text(r));

test("Direct mode is the default and nothing is held", async () => {
  const t = await setup();
  assert.equal((await t.get(`/agent-options?project=${encodeURIComponent(t.dir)}`)).classMode, "direct");
  const events = await t.build(addCache);
  assert.equal(events.some((e) => e.type === "decision_class"), false);
  const [p] = events.filter((e) => e.type === "proposal");
  assert.equal((await t.proposals())[0].status, "pending");
  assert.equal((await t.decide(p, "accept")).status, 200);
  assert.equal(t.architecture().some((n) => n.id === "cache"), true);
});

test("the mode is remembered per Project, survives a restart and rejects unknown values", async () => {
  const scratchDir = mkdtempSync(join(tmpdir(), "aidea-mode-"));
  scratch.push(scratchDir);
  const file = join(scratchDir, "preferences.json");
  const a = await setup(file);
  assert.equal((await a.setMode("spaghetti")).status, 400);
  const set = await a.setMode("class");
  assert.equal(set.status, 200);
  assert.equal((await set.json() as any).classMode, "class");
  a.core.close();
  const b = await startCore({ port: 0, adapter: fakeAgent, preferencesFile: file });
  cores.push(b);
  await fetch(b.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: a.dir }) });
  assert.equal(((await (await fetch(b.url + `/agent-options?project=${encodeURIComponent(a.dir)}`)).json()) as any).classMode, "class");
  // the builder's permission mode and models are untouched by it
  assert.equal(((await (await fetch(b.url + `/agent-options?project=${encodeURIComponent(a.dir)}`)).json()) as any).choice.mode, "default");
});

test("Class mode holds a Blocking decision: it is marked, announced, and cannot be accepted", async () => {
  const t = await setup();
  await t.setMode("class");
  let told = "";
  const events = await t.build(async function* (call) { told = text(await call("propose_add_node", { layer: "architecture", node: cache })); });
  const [p] = events.filter((e) => e.type === "proposal");
  const announce = events.find((e) => e.type === "decision_class");
  assert.deepEqual([announce.proposal, announce.project], [p.id, t.dir]);
  assert.equal(p.status, "waiting-for-class");
  assert.equal(json({ content: [{ text: told }] }).status, "waiting-for-class");
  assert.equal((await t.proposals())[0].status, "waiting-for-class");
  const refused = await t.decide(p, "accept");
  assert.equal(refused.status, 409);
  assert.match(((await refused.json()) as any).error, /class/i);
  assert.equal(t.architecture().some((n) => n.id === "cache"), false);
  assert.equal((await t.decide(p, "reject")).status, 200); // the person may always say no
});

test("a changed Node, and a Pattern group, are Blocking; a removal and a Direct-mode change are not", async () => {
  const t = await setup();
  await t.setMode("class");
  const group = { id: "hex", name: "Hexagonal", kind: "hexagonal", roles: [{ node: "web-app", role: "domain" }, { node: "quote-db", role: "infrastructure" }], rationale: cache.rationale };
  const events = await t.build(async function* (call) {
    await call("propose_update_node", { layer: "architecture", id: "web-app", changes: { technology: "Python + FastAPI" } });
    await call("propose_pattern_group", { group });
    await call("propose_add_node", { layer: "business", node: { id: "vp2", title: "Fast", block: "value propositions", rationale: cache.rationale } });
    await call("propose_remove_node", { layer: "architecture", id: "quote-db" });
  });
  const byNode = Object.fromEntries(events.filter((e) => e.type === "proposal").map((e) => [e.nodeId, e.status]));
  assert.deepEqual(byNode, { "web-app": "waiting-for-class", "pattern:hex": "waiting-for-class", vp2: "waiting-for-class", "quote-db": "pending" });
  assert.equal(events.filter((e) => e.type === "decision_class").length, 3);
});

test("the decision class: the Tutor reads the decision, the person's reason lands in the Rationale, then accepting works", async () => {
  const t = await setup();
  await t.setMode("class");
  const [p] = (await t.build(addCache)).filter((e) => e.type === "proposal");
  const seen: Record<string, any> = {};
  tutor = async function* (call, list) {
    seen.tools = await list();
    seen.read = json(await call("read_decision"));
    seen.early = await call("record_decision", { proposalId: p.id, reason: "guess", rejected: [] });
    await call("begin_step", { stepId: "d", title: "Why a cache" });
    seen.noAnswerYet = await call("record_decision", { proposalId: p.id, reason: "guess", rejected: [] });
    await call("predict", { stepId: "d", prompt: "What would you choose here, and why?" });
    await call("explain", { stepId: "d", text: "A cache keeps hot reads away from the database." });
    seen.finishEarly = await call("finish_class", { summary: "x" });
    seen.badRationale = await call("record_decision", { proposalId: p.id, reason: "", rejected: [] });
    seen.badRejected = await call("record_decision", { proposalId: p.id, reason: "ok", rejected: [{ option: "x" }] });
    seen.wrongProposal = await call("record_decision", { proposalId: "prop-999", reason: "ok", rejected: [] });
    seen.stillHeld = (await t.proposals())[0].status;
    seen.ask = await call("ask", { stepId: "d", kind: "choice", prompt: "What does a cache protect?", options: ["The database", "The browser"], correct: "The database" });
    seen.recorded = json(await call("record_decision", { proposalId: p.id, reason: "Reads dominate writes.", rejected: [{ option: "Memcached", reason: "No persistence option." }] }));
    seen.afterReady = (await t.proposals())[0].status;
    seen.finish = await call("finish_class", { summary: "Decided on a cache." });
  };
  const { events } = await t.classFor(p.id, (q) => (q.kind === "text" ? { text: "Redis, because reads dominate." } : { option: 0, confidence: 70 }));
  assert.deepEqual(seen.tools.filter((n: string) => n.endsWith("_decision")), ["read_decision", "record_decision"]);
  assert.deepEqual([seen.read.proposalId, seen.read.layer, seen.read.kind, seen.read.title], [p.id, "architecture", "add", "Cache"]);
  assert.equal(seen.read.node.technology, "Redis");
  assert.equal(seen.early.isError, true);
  assert.match(text(seen.noAnswerYet), /answer/i);
  assert.match(text(seen.finishEarly), /record_decision|open/i);
  assert.equal(seen.badRationale.isError, true);
  assert.match(text(seen.badRationale), /why/);
  assert.match(text(seen.badRejected), /reason/);
  assert.match(text(seen.wrongProposal), /decision/i);
  assert.equal(seen.stillHeld, "waiting-for-class");
  assert.equal(seen.recorded.ok, true);
  assert.equal(seen.afterReady, "pending");
  assert.equal(seen.finish.isError, undefined);
  assert.equal(events.some((e) => e.type === "tutor_finished"), true);
  assert.equal(events.some((e) => e.type === "decision_ready" && e.proposal === p.id), true);

  assert.equal((await t.decide(p, "accept")).status, 200);
  const written = t.architecture().find((n) => n.id === "cache");
  assert.equal(written.rationale.why, "Reads dominate writes.");
  assert.deepEqual(written.rationale.rejected, [{ option: "Memcached", reason: "No persistence option." }]);
  assert.equal(written.technology, "Redis");
});

test("a decision class on an update puts the reason in the changed Node and keeps the rest", async () => {
  const t = await setup();
  await t.setMode("class");
  const [p] = (await t.build(async function* (call) { await call("propose_update_node", { layer: "architecture", id: "web-app", changes: { technology: "Python + FastAPI" } }); })).filter((e) => e.type === "proposal");
  tutor = async function* (call) {
    await call("begin_step", { stepId: "d", title: "Framework" });
    await call("predict", { stepId: "d", prompt: "Which and why?" });
    await call("explain", { stepId: "d", text: "FastAPI is async." });
    await call("ask", { stepId: "d", kind: "choice", prompt: "q?", options: ["a", "b"], correct: "a" });
    await call("record_decision", { proposalId: p.id, reason: "Typed endpoints.", rejected: [] });
    await call("finish_class", { summary: "done" });
  };
  await t.classFor(p.id, (q) => (q.kind === "text" ? { text: "FastAPI" } : { option: 0 }));
  assert.equal((await t.decide(p, "accept")).status, 200);
  const node = t.architecture().find((n) => n.id === "web-app");
  assert.equal(node.technology, "Python + FastAPI");
  assert.equal(node.rationale.why, "Typed endpoints.");
  assert.equal(node.title, "Web app");
});

test("'Decide for me' makes it acceptable with the builder's Rationale untouched, and the skip is Evidence", async () => {
  const t = await setup(undefined, mkdtempSync(join(tmpdir(), "aidea-decision-learner-")));
  await t.setMode("class");
  const [p] = (await t.build(addCache)).filter((e) => e.type === "proposal");
  assert.equal((await t.post("/proposals/skip-class", { id: p.id, secret: "nope" })).status, 403);
  assert.equal((await t.post("/proposals/skip-class", { id: "prop-999", secret: "x" })).status, 404);
  assert.equal((await t.post("/proposals/skip-class", { id: p.id, secret: p.secret })).status, 200);
  assert.equal((await t.proposals())[0].status, "pending");
  assert.equal((await t.post("/proposals/skip-class", { id: p.id, secret: p.secret })).status, 409); // nothing to skip any more
  assert.equal((await t.decide(p, "accept")).status, 200);
  assert.deepEqual(t.architecture().find((n) => n.id === "cache").rationale, cache.rationale);
  const entries = (await t.get(`/learner/evidence?project=${encodeURIComponent(t.dir)}`)).entries;
  assert.deepEqual(entries.map((e: any) => [e.kind, e.decision]), [["decision-skip", p.id]]);
});

// A decision class where the check of one step is missed `misses` times, then answered correctly. Returns what the interface streamed.
async function missedClass(misses: number) {
  const t = await setup(undefined, mkdtempSync(join(tmpdir(), "aidea-decision-learner-")));
  await t.setMode("class");
  const [p] = (await t.build(addCache)).filter((e) => e.type === "proposal");
  tutor = async function* (call) {
    await call("begin_step", { stepId: "d", title: "Why a cache" });
    await call("predict", { stepId: "d", prompt: "What would you choose, and why?" });
    for (let i = 0; i <= misses; i++) {
      await call("explain", { stepId: "d", text: "A cache keeps hot reads away from the database." });
      await call("ask", { stepId: "d", kind: "choice", prompt: `What does a cache protect? (${i})`, options: ["The database", "The browser"], correct: "The database" });
    }
  };
  // option 1 is wrong until `misses` wrong answers were given
  let asked = 0;
  const { events } = await t.classFor(p.id, (q) => (q.kind === "text" ? { text: "Redis" } : { option: asked++ < misses ? 1 : 0, confidence: 50 }));
  return { t, p, events };
}

test("after three misses of the same step the class stays open and tells the interface to offer 'Decide for me'; not before, and nothing is Evidence for it", async () => {
  const { t, p, events } = await missedClass(3);
  const hints = events.filter((e) => e.type === "decision_hint");
  assert.equal(hints.length, 1);
  assert.equal(hints[0].proposal, p.id);
  // the hint comes right after the third wrong check (1 prediction + 3 checks asked before it), and the class goes on after it
  const before = events.slice(0, events.indexOf(hints[0])).filter((e) => e.type === "tutor_question");
  assert.deepEqual(before.map((e) => e.kind), ["text", "choice", "choice", "choice"]);
  assert.equal(events.slice(events.indexOf(hints[0])).some((e) => e.type === "tutor_question"), true);
  assert.equal((await t.proposals())[0].status, "waiting-for-class"); // still held: the person decides what to do
  const kinds = (await t.get(`/learner/evidence?project=${encodeURIComponent(t.dir)}`)).entries.map((e: any) => e.kind);
  assert.equal(kinds.includes("decision-skip"), false);
  assert.equal((await t.post("/proposals/skip-class", { id: p.id, secret: p.secret })).status, 200); // the button's action
});

test("two misses, or a class answered correctly, show no hint", async () => {
  assert.equal((await missedClass(2)).events.some((e) => e.type === "decision_hint"), false);
  assert.equal((await missedClass(0)).events.some((e) => e.type === "decision_hint"), false);
});

test("a decision class needs a held Proposal of that Project", async () => {
  const t = await setup();
  const [direct] = (await t.build(addCache)).filter((e) => e.type === "proposal"); // Direct mode: not held
  assert.equal((await t.classFor(direct.id)).status, 400);
  assert.equal((await t.classFor("prop-999")).status, 400);
  assert.equal((await t.post("/tutor/classes", { project: t.dir, decision: 7 })).status, 400);
});

test("the decision-class instructions stay within the Tutor's budget and name the tools in order", async () => {
  const { DECISION_INSTRUCTIONS } = await import("../src/core/decision-class.ts");
  assert.ok(DECISION_INSTRUCTIONS.length < 4000);
  const order = ["read_decision:", "predict {", "explain {", "ask {", "record_decision {", "finish_class {"].map((n) => DECISION_INSTRUCTIONS.indexOf(n));
  assert.ok(order.every((i, k) => i >= 0 && (k === 0 || i > order[k - 1])));
});

test("an ordinary class has no decision tools", async () => {
  const t = await setup();
  let tools: string[] = [];
  let attempt: any;
  tutor = async function* (call, list) { tools = await list(); attempt = await call("record_decision", { proposalId: "x", reason: "y", rejected: [] }); };
  const res = await t.post("/tutor/classes", { project: t.dir });
  await res.text();
  assert.equal(tools.some((n) => n.endsWith("_decision")), false);
  assert.equal(attempt, undefined); // unknown tool: a protocol error, not a result
});
