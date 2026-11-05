import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// tutor-rewrite 06: what a plugin's check says about a task is Evidence in the Learner graph: "did it", marked as coming from a check, with the plugin and the check named. Never a score.
type RunOptions = Parameters<Adapter["run"]>[0];
type Call = (name: string, args: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;
let tutor: (call: Call, opts: RunOptions) => AsyncGenerator<AgentEvent> = async function* () {};
const fakeAgent: Adapter = {
  options: { modes: [], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    if (opts.role !== "tutor") return;
    const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
    const rpc = async (method: string, params: unknown = {}) =>
      (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method, params }) })).json()).result;
    yield* tutor((name, args) => rpc("tools/call", { name, arguments: args }), opts);
  },
};
const scratch = mkdtempSync(join(tmpdir(), "aidea-evidence-checks-"));
const cores: Awaited<ReturnType<typeof startCore>>[] = [];
after(async () => { for (const c of cores) { await c.plugins.deactivate("canvas"); c.close(); } });
const project = fixture("shop");

async function newCore() {
  const dir = join(scratch, "canvas");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id: "canvas", version: "1.0.0", title: "Canvas", description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", teach: { view: "state", module: "teach.mjs", checks: [{ name: "has-relation", says: "A relation between two Nodes exists.", args: { from: "string", to: "string" } }] } }));
  writeFileSync(join(dir, "main.js"), "export function activate(ctx) { ctx.teach.state(() => ({ relations: [['shop', 'db']] })); }");
  writeFileSync(join(dir, "teach.mjs"), 'export const view = (s) => s;\nexport const checks = { "has-relation": (s, a) => { const f = s.relations.some(([x, y]) => x === a.from && y === a.to); return { ok: f, reason: f ? "The relation exists." : "There is no such relation." }; } };');
  const store = mkdtempSync(join(scratch, "store"));
  cpSync(dir, join(store, "canvas"), { recursive: true });
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: mkdtempSync(join(scratch, "l")), pluginsDir: store, builtinPluginsDir: false });
  cores.push(core);
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
  const post = (path: string, b: unknown = {}) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
  const session = async (reply: (q: any) => Record<string, unknown>) => {
    const res = await post("/tutor/classes", { project, message: "Teach me the Canvas" });
    let buf = "";
    for await (const chunk of res.body as any) {
      buf += Buffer.from(chunk).toString();
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const line of lines) {
        if (!line) continue;
        const e = JSON.parse(line);
        if (e.type === "tutor_question") await post("/tutor/answer", { id: e.id, secret: e.secret, ...reply(e) });
      }
    }
  };
  const get = async (path: string) => (await fetch(core.url + path)).json() as Promise<any>;
  return { core, session, get };
}
const task = (from: string, to: string) => ({ stepId: "s1", kind: "task", prompt: `Draw a relation from ${from} to ${to}.`, plugin: "canvas", check: "has-relation", args: { from, to } });
const begin = async (call: Call) => {
  await call("set_plan", { concepts: [{ name: "relations", dependsOn: [] }] });
  await call("plan_ahead", { summary: "Relations." });
  await call("begin_step", { stepId: "s1", title: "Relations", item: "relations" });
  await call("predict", { stepId: "s1", prompt: "How would you link two boxes?" });
  await call("explain", { stepId: "s1", text: "A relation links two Nodes." });
};
const answer = (q: any) => (q.phase === "plan" ? { option: 0 } : q.kind === "task" ? { done: true } : { text: "a guess" });
const evidenceOf = async (t: Awaited<ReturnType<typeof newCore>>) => (await t.get(`/learner/evidence?project=${encodeURIComponent(project)}`)).entries.filter((e: any) => e.kind === "task");

test("a check that passed is Evidence of 'did it', marked as coming from a check, with the plugin and the check named; the Plan item counts as covered", async () => {
  const t = await newCore();
  tutor = async function* (call) { await begin(call); await call("ask", task("shop", "db")); yield { type: "text", text: "done" }; };
  await t.session(answer);
  const [e] = await evidenceOf(t);
  assert.ok(e, "the task left Evidence");
  assert.deepEqual([e.kind, e.correct, e.phase, e.item, e.stepId], ["task", true, "check", "relations", "s1"]);
  assert.deepEqual(e.check, { plugin: "canvas", name: "has-relation" });
  assert.equal(e.confidence, null);
  assert.deepEqual((await t.get(`/tutor/plan?project=${encodeURIComponent(project)}`)).covered, ["relations"]);
});

test("a failed check is recorded as an attempt that was not done, and the next try is a second entry", async () => {
  const t = await newCore();
  tutor = async function* (call) {
    await begin(call);
    await call("ask", task("db", "shop"));
    await call("explain", { stepId: "s1", text: "From the other side." });
    await call("ask", task("shop", "db"));
    yield { type: "text", text: "done" };
  };
  await t.session(answer);
  const entries = await evidenceOf(t);
  assert.deepEqual(entries.map((e: any) => [e.correct, e.attempt]), [[false, 1], [true, 2]]);
});

test("'Don't know' is recorded as such, with nothing demonstrated; and the entry holds no score, level or number of its own", async () => {
  const t = await newCore();
  tutor = async function* (call) { await begin(call); await call("ask", task("shop", "db")); yield { type: "text", text: "done" }; };
  await t.session((q) => (q.kind === "task" ? { dontKnow: true } : answer(q)));
  const [e] = await evidenceOf(t);
  assert.deepEqual([e.correct, e.dontKnow], [null, true]);
  assert.deepEqual(Object.keys(e).filter((k) => /score|level|grade|mastery|points/i.test(k)), []);
});
