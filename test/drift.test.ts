import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

type Call = (name: string, args: unknown) => Promise<{ content: { text: string }[]; isError?: boolean }>;
type RunOptions = Parameters<Adapter["run"]>[0];

// A stand-in for Claude Code: it records how the Tutor was launched and runs a script over the core's tools.
let teacher: (call: Call) => AsyncGenerator<AgentEvent> = async function* () {};
const launches: RunOptions[] = [];
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    launches.push(opts);
    if (opts.role === "extractor") return yield { type: "result", text: "", structured: { propositions: [], chains: [] }, usage: {} };
    if (opts.role === "auditor") return yield { type: "result", text: "", structured: { links: [] }, usage: {} };
    if (opts.role !== "tutor") return;
    const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
    const call: Call = async (name, args) =>
      (await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) })).json()).result;
    yield* teacher(call);
  },
};

const cores: Awaited<ReturnType<typeof startCore>>[] = [];
async function newCore() {
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: mkdtempSync(join(tmpdir(), "aidea-drift-")) });
  cores.push(core);
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const get = async (path: string) => (await fetch(core.url + path)).json() as Promise<any>;
  return { core, post, get };
}
after(() => cores.forEach((c) => c.close()));

const why = { why: "Because.", rejected: [] };
// A small project whose Contract and code disagree in every way the drift list knows, and agree in the ways it must leave alone.
function drifting() {
  const dir = mkdtempSync(join(tmpdir(), "aidea-drift-project-"));
  const py: Record<string, string> = {
    "web.py": "import service\n\n\ndef handle():\n    return service.run()\n",
    "service.py": "import store\n\n\ndef run():\n    return store.load()\n",
    "store.py": "def load():\n    return 1\n",
    "cache.py": "def get():\n    return 1\n",
    "ui.py": "import service\nimport store\n\n\ndef draw():\n    return service.run() + store.load()\n",
    "helper.py": "import service\nimport web\n\n\ndef help():\n    return web.handle()\n",
  };
  for (const [f, text] of Object.entries(py)) writeFileSync(join(dir, f), text);
  mkdirSync(join(dir, ".aidea"));
  const node = (id: string, traces: string[], extra: object = {}) => ({ id, title: id, technology: "Python", traces, rationale: why, ...extra });
  writeFileSync(join(dir, ".aidea", "architecture.json"), JSON.stringify({
    nodes: [
      node("web", ["web"], { relations: [{ to: "service", label: "calls" }] }),
      node("service", ["service"], { relations: [{ to: "store", label: "reads" }, { to: "cache", label: "uses" }] }),
      node("store", ["store"]),
      node("cache", ["cache"]),
      node("ui", ["ui"], { relations: [{ to: "service", label: "asks" }] }),
      node("helper", ["helper"], { parent: "web", relations: [{ to: "service", label: "uses" }] }),
    ],
  }));
  const fr = (id: string, extra: object) => ({ id, title: id, as: "a shopper", want: "something", so: "it helps", rationale: why, ...extra });
  writeFileSync(join(dir, ".aidea", "requirements.json"), JSON.stringify({
    nodes: [
      fr("r-built", { traces: ["web.handle"] }),
      fr("r-todo", {}),
      fr("r-lost", { traces: ["web.gone"] }),
      fr("r-claimed", { built: true }),
    ],
  }));
  return dir;
}
const key = (d: any) => `${d.type}:${d.nodes.join(">")}`;

test("each kind of difference is detected, and what the Contract allows is left alone", async () => {
  const t = await newCore();
  const dir = drifting();
  await t.post("/projects", { path: dir });
  const { drift } = await t.get(`/drift?project=${encodeURIComponent(dir)}`);
  assert.deepEqual(drift.map(key).sort(), [
    "broken-trace:r-lost>web.gone",
    "built-without-code:r-claimed",
    "missing-relationship:service>cache",
    "undeclared-dependency:ui>store",
  ]);
  for (const d of drift) {
    assert.ok(d.id && typeof d.id === "string", "an id");
    assert.ok(Array.isArray(d.nodes) && d.nodes.length >= 1, "Node ids");
    assert.ok(typeof d.explanation === "string" && d.explanation.length > 20, "an explanation in words");
    assert.ok(["requirements", "architecture"].includes(d.layer), "the layer it is about");
  }
  const crossing = drift.find((d: any) => d.type === "undeclared-dependency");
  assert.equal(crossing.certainty, "certain");
  assert.match(crossing.explanation, /ui/);
  assert.match(crossing.explanation, /store/);
});

test("a requirement not built yet is not drift; one marked built with no code is; a broken link is", async () => {
  const t = await newCore();
  const dir = drifting();
  await t.post("/projects", { path: dir });
  const ids = (await t.get(`/drift?project=${encodeURIComponent(dir)}`)).drift.flatMap((d: any) => d.nodes);
  assert.ok(!ids.includes("r-todo"));
  assert.ok(!ids.includes("r-built"));
  assert.ok(ids.includes("r-claimed"));
  assert.ok(ids.includes("r-lost"));
});

test("the list is deterministic and is the one the Contract carries", async () => {
  const t = await newCore();
  const dir = drifting();
  await t.post("/projects", { path: dir });
  const a = await t.get(`/drift?project=${encodeURIComponent(dir)}`);
  const b = await t.get(`/drift?project=${encodeURIComponent(dir)}`);
  assert.deepEqual(a, b);
  assert.deepEqual((await t.get(`/contract?project=${encodeURIComponent(dir)}`)).drift, a.drift);
});

test("Pattern group violations join the list with Node ids and an explanation", async () => {
  const t = await newCore();
  const dir = mkdtempSync(join(tmpdir(), "aidea-drift-hex-"));
  cpSync(fixture("hexagonal"), dir, { recursive: true });
  await t.post("/projects", { path: dir });
  const { drift } = await t.get(`/drift?project=${encodeURIComponent(dir)}`);
  assert.equal(drift.length, 1);
  assert.deepEqual([drift[0].type, drift[0].nodes], ["pattern", ["core", "store"]]);
  assert.match(drift[0].explanation, /domain Node may not depend on an infrastructure Node/);
});

test("a Project that declares no relations has said nothing the code can contradict", async () => {
  const t = await newCore();
  const dir = mkdtempSync(join(tmpdir(), "aidea-drift-clean-"));
  cpSync(fixture("hexagonal-clean"), dir, { recursive: true });
  await t.post("/projects", { path: dir });
  assert.deepEqual((await t.get(`/drift?project=${encodeURIComponent(dir)}`)).drift, []);
  assert.equal((await fetch(t.core.url + "/drift?project=nope")).status, 404);
});

test("a class started from a difference carries it as the topic, and its answers are Evidence", async () => {
  const t = await newCore();
  const dir = drifting();
  const opened = await (await t.post("/projects", { path: dir })).json();
  const project = opened.id;
  const target = (await t.get(`/drift?project=${encodeURIComponent(project)}`)).drift.find((d: any) => d.type === "undeclared-dependency");
  teacher = async function* (call) {
    await call("begin_step", { stepId: "s1", title: "Why does ui reach store?" });
    await call("predict", { stepId: "s1", prompt: "Why might the UI read the store directly?" });
    yield { type: "text", text: "done" };
  };
  launches.length = 0;
  const res = await t.post("/tutor/classes", { project, drift: target.id });
  let buf = "";
  for await (const chunk of res.body as any) {
    buf += Buffer.from(chunk).toString();
    const lines = buf.split("\n");
    buf = lines.pop()!;
    for (const line of lines.filter(Boolean)) {
      const e = JSON.parse(line);
      if (e.type === "tutor_question") await t.post("/tutor/answer", { id: e.id, secret: e.secret, text: "a shortcut" });
    }
  }
  const tutor = launches.find((l) => l.role === "tutor")!;
  assert.ok(tutor.message.includes(target.explanation), "the difference is the topic");
  assert.match(tutor.message, /ui/);
  assert.match(tutor.message, /store/);
  assert.match(tutor.message, /not a block|never a block|information/i);
  const evidence = (await t.get(`/learner/evidence?project=${encodeURIComponent(project)}`)).entries;
  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].answer, "a shortcut");
});

test("a drift id that is not on the list is refused", async () => {
  const t = await newCore();
  const dir = drifting();
  const project = (await (await t.post("/projects", { path: dir })).json()).id;
  const res = await t.post("/tutor/classes", { project, drift: "nope" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /drift/i);
});

// A project from python files and authored layers, for the edge cases below.
function build(files: Record<string, string>, layers: Record<string, unknown>) {
  const dir = mkdtempSync(join(tmpdir(), "aidea-drift-edge-"));
  for (const [f, text] of Object.entries(files)) writeFileSync(join(dir, f), text);
  mkdirSync(join(dir, ".aidea"));
  for (const [name, nodes] of Object.entries(layers)) writeFileSync(join(dir, ".aidea", `${name}.json`), JSON.stringify({ nodes }));
  return dir;
}
const anode = (id: string, traces: string[], extra: object = {}) => ({ id, title: id, technology: "Python", traces, rationale: why, ...extra });
const driftOfDir = async (t: Awaited<ReturnType<typeof newCore>>, dir: string) => {
  await t.post("/projects", { path: dir });
  const res = await fetch(`${t.core.url}/drift?project=${encodeURIComponent(dir)}`);
  return { status: res.status, drift: ((await res.json()) as any).drift as any[] };
};

test("two Nodes that stand for the same module cannot be told apart, so a relation between them is not called missing", async () => {
  const t = await newCore();
  const dir = build({ "m.py": "def f():\n    return 1\n", "n.py": "import m\n" }, {
    architecture: [anode("p", ["m.f"], { relations: [{ to: "q", label: "uses" }] }), anode("q", ["m.f"]), anode("r", ["n"])],
  });
  assert.deepEqual((await driftOfDir(t, dir)).drift, []);
});

test("a Node inside a Node that declares a relation may use what the parent may use", async () => {
  const t = await newCore();
  const dir = build({ "s.py": "def go():\n    return 1\n", "c.py": "import s\n\n\ndef run():\n    return s.go()\n", "p.py": "import s\n" }, {
    architecture: [anode("parent", ["p"], { relations: [{ to: "store", label: "uses" }] }), anode("child", ["c"], { parent: "parent", relations: [{ to: "kid", label: "owns" }] }), anode("store", ["s"]), anode("kid", [], { parent: "store" })],
  });
  assert.deepEqual((await driftOfDir(t, dir)).drift, []);
});

test("odd data in the authored files never breaks the list", async () => {
  const t = await newCore();
  const dir = build({ "a.py": "import b\n", "b.py": "def go():\n    return 1\n" }, {
    architecture: [anode("a", ["a"], { relations: "b" }), anode("b", ["b"], { relations: [null, 3, { to: 7 }, { to: "a" }] }), anode("x>y", ["a"], { relations: [{ to: "b", label: "uses" }] })],
    requirements: [{ id: "r", title: "r", as: "a", want: "w", so: "s", traces: "not-a-list", built: true, rationale: why }],
  });
  const { status, drift } = await driftOfDir(t, dir);
  assert.equal(status, 200);
  assert.ok(Array.isArray(drift));
});

test("two differences with the same Nodes on different layers have different ids", async () => {
  const t = await newCore();
  const dir = build({ "a.py": "def go():\n    return 1\n" }, {
    business: [{ id: "n1", title: "n1", block: "customer segments", traces: ["gone"], rationale: why }],
    requirements: [{ id: "n1", title: "n1", as: "a", want: "w", so: "s", traces: ["gone"], rationale: why }],
  });
  const { drift } = await driftOfDir(t, dir);
  const broken = drift.filter((d) => d.type === "broken-trace");
  assert.equal(broken.length, 2);
  assert.notEqual(broken[0].id, broken[1].id);
});
