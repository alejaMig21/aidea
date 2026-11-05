import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { loadAuthored } from "../src/core/authored.ts";
import { TUTOR_INSTRUCTIONS } from "../src/core/tutor.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

type RunOptions = Parameters<Adapter["run"]>[0];
type Call = (name: string, args: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;

// A stand-in for Claude Code: the Tutor is a script over the core's MCP tools.
let tutor: (call: Call) => AsyncGenerator<AgentEvent> = async function* () {};
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts: RunOptions): AsyncGenerator<AgentEvent> {
    if (opts.role === "extractor") return yield { type: "result", text: "", structured: { ideas: [] }, usage: {} };
    if (opts.role === "auditor") return yield { type: "result", text: "", structured: { links: [] }, usage: {} };
    if (opts.role !== "tutor") return;
    const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
    const rpc = async (method: string, params: unknown) =>
      (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method, params }) })).json()).result;
    const call: Call = (name, args) => rpc("tools/call", { name, arguments: args });
    (call as any).list = async () => (await rpc("tools/list", {})).tools.map((t: { name: string }) => t.name);
    yield* tutor(call);
  },
};

const scratch: string[] = [];
const cores: Awaited<ReturnType<typeof startCore>>[] = [];
after(() => {
  cores.forEach((c) => c.close());
  scratch.forEach((d) => rmSync(d, { recursive: true, force: true }));
});

// A private copy of the studio fixture (it has authored layers), opened as a Project.
async function newCore() {
  const project = mkdtempSync(join(tmpdir(), "aidea-coauthor-"));
  scratch.push(project);
  cpSync(fixture("studio"), project, { recursive: true });
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: mkdtempSync(join(tmpdir(), "aidea-coauthor-l-")) });
  cores.push(core);
  const post = (path: string, body: unknown = {}, signal?: AbortSignal) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });
  await post("/projects", { path: project });
  const runClass = async (reply: (q: any) => Record<string, unknown> = () => ({ text: "a customer who sells their own work" })) => {
    const res = await post("/tutor/classes", { project });
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
  const proposals = async () => ((await (await fetch(`${core.url}/proposals?project=${encodeURIComponent(project)}`)).json()) as any).proposals as any[];
  const layerFile = (layer: string) => loadAuthored(project).layers[layer] as any; // whichever way the layer is stored
  return { core, project, post, runClass, proposals, layerFile };
}

const text = (r: { content: { text: string }[] }) => r.content[0].text;
const SEGMENTS = "business:customer-segments";
const askElement = (element = SEGMENTS, prompt = "In your own words, who is this business for?") => ({ kind: "text", prompt, element });
const segment = {
  id: "freelancers", title: "Freelancers", block: "customer segments",
  rationale: { why: "You said: a customer who sells their own work.", rejected: [{ option: "Large agencies", reason: "Out of scope for now." }] },
};

test("a Proposal tool is refused until the person answered a question about the same element, then it makes a pending Proposal from the Tutor", async () => {
  const t = await newCore();
  const seen: Record<string, any> = {};
  tutor = async function* (call) {
    seen.before = await call("propose_node", { layer: "business", node: segment, element: SEGMENTS });
    seen.ask = await call("ask", askElement());
    seen.otherElement = await call("propose_node", { layer: "business", node: segment, element: "business:channels" });
    seen.proposed = await call("propose_node", { layer: "business", node: segment, element: SEGMENTS, because: "They described their customer." });
    yield { type: "text", text: "done" };
  };
  const events = await t.runClass();
  assert.equal(seen.before.isError, true);
  assert.match(text(seen.before), /Ask the person about business:customer-segments first and wait for the answer/);
  assert.equal(seen.ask.isError, undefined);
  assert.equal(JSON.parse(text(seen.ask)).answer, "a customer who sells their own work");
  assert.equal(seen.otherElement.isError, true);
  assert.match(text(seen.otherElement), /business:channels first/);
  assert.equal(seen.proposed.isError, undefined);
  assert.equal(JSON.parse(text(seen.proposed)).status, "pending");

  const created = events.filter((e) => e.type === "proposal");
  assert.equal(created.length, 1);
  const [p] = await t.proposals();
  assert.equal(p.status, "pending");
  assert.equal(p.layer, "business");
  assert.equal(p.nodeId, "freelancers");
  assert.equal(p.fromAnswer, "a customer who sells their own work");
  assert.equal(p.source.role, "tutor");
  assert.match(p.source.classId, /^c-/);
  assert.match(p.source.questionId, /^q-/);
  assert.equal(p.secret, undefined);
  assert.equal(t.layerFile("business").nodes.some((n: any) => n.id === "freelancers"), false, "nothing is written until the person accepts");
});

test("an I don't know answer does not open the element, and a choice question cannot carry an element", async () => {
  const t = await newCore();
  const seen: Record<string, any> = {};
  tutor = async function* (call) {
    seen.choice = await call("ask", { kind: "choice", prompt: "Which?", options: ["a", "b"], correct: "a", element: SEGMENTS });
    seen.unknown = await call("ask", askElement());
    seen.after = await call("propose_node", { layer: "business", node: segment, element: SEGMENTS });
    seen.noElement = await call("propose_node", { layer: "business", node: segment });
    yield { type: "text", text: "done" };
  };
  await t.runClass(() => ({ dontKnow: true }));
  assert.equal(seen.choice.isError, true);
  assert.match(text(seen.choice), /text/);
  assert.match(text(seen.unknown), /dontKnow/);
  assert.equal(seen.after.isError, true);
  assert.match(text(seen.after), /Ask the person about/);
  assert.match(text(seen.noElement), /element/);
  assert.deepEqual(await t.proposals(), []);
});

test("a Tutor Proposal refused because the id is waiting or the Node exists tells the interface why; a malformed call does not", async () => {
  const t = await newCore();
  const seen: Record<string, any> = {};
  tutor = async function* (call) {
    await call("ask", askElement());
    await call("propose_node", { layer: "business", node: segment, element: SEGMENTS });
    seen.again = await call("propose_node", { layer: "business", node: segment, element: SEGMENTS });
    seen.exists = await call("propose_node", { layer: "architecture", node: { id: "web-app", title: "X", technology: "x", rationale: segment.rationale }, element: SEGMENTS });
    await call("propose_node", { layer: "code", node: segment, element: SEGMENTS });
    await call("propose_node", { layer: "business", node: { id: "x", title: "X", rationale: segment.rationale }, element: SEGMENTS });
    yield { type: "text", text: "done" };
  };
  const events = await t.runClass();
  const waiting = events.find((e) => e.type === "proposal");
  const refused = events.filter((e) => e.type === "proposal_refused");
  assert.equal(refused.length, 2);
  assert.deepEqual(
    { reason: refused[0].reason, nodeId: refused[0].nodeId, layer: refused[0].layer, proposalId: refused[0].proposalId, source: refused[0].source },
    { reason: "pending", nodeId: "freelancers", layer: "business", proposalId: waiting.id, source: "tutor" },
  );
  assert.deepEqual({ reason: refused[1].reason, nodeId: refused[1].nodeId, proposalId: refused[1].proposalId }, { reason: "exists", nodeId: "web-app", proposalId: undefined });
  assert.equal(seen.again.isError, true);
  assert.match(text(seen.again), /already pending/); // the model still gets its error text
});

test("bad fields are refused with the builder's messages", async () => {
  const t = await newCore();
  const bad: [string, any, RegExp][] = [
    ["propose_node", { layer: "business", node: { id: "x", title: "X", rationale: segment.rationale }, element: SEGMENTS }, /Invalid node: .*block/],
    ["propose_node", { layer: "code", node: segment, element: SEGMENTS }, /layer must be one of/],
    ["propose_node", { layer: "business", node: "freelancers", element: SEGMENTS }, /node must be an object/],
    ["propose_node", { layer: "architecture", node: { id: "web-app", title: "X", technology: "x", rationale: segment.rationale }, element: SEGMENTS }, /already exists/],
    ["propose_change", { layer: "architecture", id: "ghost", changes: { title: "X" }, element: SEGMENTS }, /not found/i],
    ["propose_change", { layer: "architecture", id: "web-app", changes: { id: "renamed" }, element: SEGMENTS }, /"id" of a Node cannot be changed/],
    ["propose_change", { layer: "architecture", id: "web-app", changes: {}, element: SEGMENTS }, /changes must be an object/],
  ];
  const told: any[] = [];
  tutor = async function* (call) {
    await call("ask", askElement());
    for (const [name, args] of bad) told.push(await call(name, args));
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  bad.forEach(([, , re], i) => {
    assert.equal(told[i].isError, true, String(i));
    assert.match(text(told[i]), re);
  });
  assert.deepEqual(await t.proposals(), []);
});

test("propose_change makes a pending change; accepting writes it, rejecting does not, exactly as for the builder", async () => {
  const t = await newCore();
  const events: any[] = [];
  tutor = async function* (call) {
    await call("ask", askElement("architecture:web-app", "What should the web app be called?"));
    await call("propose_change", { layer: "architecture", id: "web-app", changes: { title: "Storefront" }, element: "architecture:web-app" });
    await call("ask", askElement(SEGMENTS));
    await call("propose_node", { layer: "business", node: segment, element: SEGMENTS });
    yield { type: "text", text: "done" };
  };
  events.push(...(await t.runClass()));
  const [change, add] = events.filter((e) => e.type === "proposal");
  assert.equal(change.kind, "update");
  assert.deepEqual(change.source.role, "tutor");
  assert.equal(change.fromAnswer, "a customer who sells their own work");

  const decide = async (e: any, decision: string) => (await t.post("/proposals/answer", { id: e.id, secret: e.secret, decision })).status;
  assert.equal(await decide(change, "accept"), 200);
  assert.equal(t.layerFile("architecture").nodes.find((n: any) => n.id === "web-app").title, "Storefront");
  assert.equal(await decide(add, "reject"), 200);
  assert.equal(t.layerFile("business").nodes.some((n: any) => n.id === "freelancers"), false);
  assert.deepEqual(await t.proposals(), []);
});

test("an accepted Tutor Node can cite the person's words in its Rationale, and the answer is Evidence", async () => {
  const t = await newCore();
  let classId = "";
  tutor = async function* (call) {
    await call("ask", askElement());
    await call("propose_node", { layer: "business", node: segment, element: SEGMENTS });
    yield { type: "text", text: "done" };
  };
  const events = await t.runClass();
  const p = events.find((e) => e.type === "proposal");
  classId = p.source.classId;
  await t.post("/proposals/answer", { id: p.id, secret: p.secret, decision: "accept" });
  assert.match(t.layerFile("business").nodes.find((n: any) => n.id === "freelancers").rationale.why, /a customer who sells their own work/);
  const evidence = ((await (await fetch(`${t.core.url}/learner/evidence?class=${classId}`)).json()) as any).entries as any[];
  assert.equal(evidence.some((e) => e.answer === "a customer who sells their own work" && e.questionId === p.source.questionId), true);
});

test("the Tutor can change a Node only by a Proposal: the tool list, and the instructions teach asking first", async () => {
  const t = await newCore();
  let names: string[] = [];
  tutor = async function* (call) {
    names = await (call as any).list();
    yield { type: "text", text: "done" };
  };
  await t.runClass();
  assert.deepEqual(names, ["begin_step", "predict", "explain", "ask", "review", "measure", "measure_done", "held_ideas", "finish_class", "propose_node", "propose_change", "get_plan", "plan_ahead", "set_plan", "read_layers", "read_node", "list_files", "read_file", "read_recording", "read_quarantined_plugin", "list_plugin_lessons", "read_plugin_lesson", "read_plugin_view", "check_plugin"]);
  assert.ok(TUTOR_INSTRUCTIONS.length <= 4000, `${TUTOR_INSTRUCTIONS.length} characters`);
  assert.match(TUTOR_INSTRUCTIONS, /element/);
  assert.match(TUTOR_INSTRUCTIONS, /own words/);
  assert.match(TUTOR_INSTRUCTIONS, /Other ways to see this/);
});
