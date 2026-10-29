import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { adapterFor, registerAdapter } from "../src/core/adapters.ts";
import type { LanguageAdapter } from "../src/core/adapters.ts";
import { startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
let dir: string;
const python = adapterFor("anything");
const calls: string[] = [];

const node = (id: string, kind: "module" | "function", parent: string | null) => ({ id, kind, name: id.split(".").pop()!, parent, file: "m.fake", line: 1, endLine: 2 });

// A language that can analyse and draw a flow but cannot run anything.
const fake: LanguageAdapter = {
  async analyze(path) {
    calls.push(`analyze ${path}`);
    return { nodes: [node("m", "module", null), node("m.f", "function", "m")], errors: [], relationships: [], unresolved: 0 };
  },
  async flow(file, qualifiedName) {
    calls.push(`flow ${qualifiedName}`);
    return { steps: [{ id: "s1", kind: "start", label: "f()" }, { id: "s2", kind: "return", label: "return" }], edges: [{ from: "s1", to: "s2" }] };
  },
};

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "aidea-fake-"));
  writeFileSync(join(dir, "m.fake"), "f\n");
  registerAdapter("python", fake);
  t = await startTestCore();
});
after(() => {
  registerAdapter("python", python);
  t.core.close();
  rmSync(dir, { recursive: true, force: true });
});

test("opening a project, drawing a flow and running a function all go through the registered adapter", async () => {
  const opened = await t.post("/projects", { path: dir });
  assert.equal(opened.status, 201);
  assert.deepEqual((await opened.json()).nodes.map((n: { id: string }) => n.id), ["m", "m.f"]);

  const q = `project=${encodeURIComponent(dir)}&node=m.f`;
  const flow = await t.get(`/algorithm?${q}`);
  assert.equal(flow.status, 200);
  assert.equal((await flow.json()).steps.length, 2);
  assert.deepEqual(calls, [`analyze ${dir}`, "flow f"]);
});

test("an adapter that cannot run a function answers in plain words, not with a crash", async () => {
  const res = await t.post("/playback", { project: dir, node: "m.f" });
  assert.equal(res.status, 422);
  assert.match((await res.json()).error, /cannot run functions yet/);
});

test("an adapter that cannot draw a flow answers in plain words, not with a crash", async () => {
  const { flow, ...noFlow } = fake;
  registerAdapter("python", noFlow);
  try {
    const res = await t.get(`/algorithm?project=${encodeURIComponent(dir)}&node=m.f`);
    assert.equal(res.status, 422);
    assert.match((await res.json()).error, /cannot draw an Algorithm graph yet/);
  } finally {
    registerAdapter("python", fake);
  }
});

test("a run goes to the adapter with the project, the function and the inputs", async () => {
  let seen: unknown;
  registerAdapter("python", { ...fake, async run(req) { seen = req; return { outcome: { steps: [] }, interpreter: "fake" }; } });
  try {
    const res = await t.post("/playback", { project: dir, node: "m.f", args: [1] });
    assert.equal(res.status, 201);
    assert.equal((await res.json()).interpreter, "fake");
    assert.equal((seen as { qualifiedName: string }).qualifiedName, "f");
    assert.deepEqual((seen as { input: { args: unknown[] } }).input.args, [1]);
  } finally {
    registerAdapter("python", fake);
  }
});
