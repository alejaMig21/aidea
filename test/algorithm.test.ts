import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
before(async () => {
  t = await startTestCore();
  await t.post("/projects", { path: fixture("flow") });
});
after(() => t.core.close());

type Step = { id: string; kind: string; label: string; text: string; line: number; endLine: number; reads: string[]; writes: string[] };
type Edge = { from: string; to: string; label?: string; back?: boolean };
type Rect = { id: string; x: number; y: number; width: number; height: number };

const algorithm = (node: string) =>
  t.get(`/algorithm?project=${encodeURIComponent(fixture("flow"))}&node=${encodeURIComponent(node)}`);

// Edges described by the labels of their ends, so the expectations read like the picture.
const describe = (steps: Step[], edges: Edge[]) => {
  const label = new Map(steps.map((s) => [s.id, s.label]));
  return edges.map((e) => `${label.get(e.from)} -> ${label.get(e.to)}${e.label ? ` [${e.label}]` : ""}${e.back ? " (back)" : ""}`).sort();
};

test("a method with a loop and a branch becomes an Algorithm graph with matching steps and branches", async () => {
  const res = await algorithm("shapes.Scorer.classify");
  assert.equal(res.status, 200);
  const g = await res.json();
  assert.deepEqual(
    g.steps.map((s: Step) => `${s.kind} | ${s.label}`),
    [
      "start | classify(self, items, limit)",
      "step | total = 0",
      "loop | for item in items",
      "branch | if item > limit",
      "step | total += item",
      "return | return total",
      "end | end",
    ],
  );
  assert.deepEqual(
    describe(g.steps, g.edges),
    [
      "classify(self, items, limit) -> total = 0",
      "total = 0 -> for item in items",
      "for item in items -> if item > limit [true]",
      "if item > limit -> total += item [true]",
      "total += item -> for item in items (back)",
      "if item > limit -> for item in items [false] (back)",
      "for item in items -> return total [false]",
      "return total -> end",
    ].sort(),
  );
});

test("a while loop is a loop step with a way in, a way around and a way out", async () => {
  const g = await (await algorithm("shapes.drain")).json();
  assert.deepEqual(
    g.steps.map((s: Step) => `${s.kind} | ${s.label}`),
    ["start | drain(total)", "loop | while total > 100", "step | total -= 10", "return | return total", "end | end"],
  );
  assert.deepEqual(
    describe(g.steps, g.edges),
    [
      "drain(total) -> while total > 100",
      "while total > 100 -> total -= 10 [true]",
      "total -= 10 -> while total > 100 (back)",
      "while total > 100 -> return total [false]",
      "return total -> end",
    ].sort(),
  );
});

test("try, except, break and continue are drawn as steps with the right ways in and out", async () => {
  const g = await (await algorithm("more.risky")).json();
  assert.deepEqual(
    g.steps.map((s: Step) => `${s.kind} | ${s.label}`),
    [
      "start | risky(path)",
      "step | try",
      "step | data = open(path)",
      "step | except OSError",
      "return | return None",
      "loop | for line in data",
      "branch | if not line",
      "step | break",
      "branch | if line == '#'",
      "step | continue",
      "return | return data",
      "end | end",
    ],
  );
  assert.deepEqual(
    describe(g.steps, g.edges),
    [
      "risky(path) -> try",
      "try -> data = open(path)",
      "try -> except OSError [error]",
      "except OSError -> return None",
      "data = open(path) -> for line in data",
      "for line in data -> if not line [true]",
      "if not line -> break [true]",
      "if not line -> if line == '#' [false]",
      "if line == '#' -> continue [true]",
      "continue -> for line in data (back)",
      "if line == '#' -> for line in data [false] (back)",
      "for line in data -> return data [false]",
      "break -> return data",
      "return None -> end",
      "return data -> end",
    ].sort(),
  );
});

test("each step carries its exact source, its lines and the names it reads and writes", async () => {
  const g = await (await algorithm("shapes.Scorer.classify")).json();
  const add = g.steps.find((s: Step) => s.label === "total += item");
  assert.deepEqual(add, { ...add, kind: "step", text: "total += item", line: 6, endLine: 6, reads: ["item", "total"], writes: ["total"] });
  const loop = g.steps.find((s: Step) => s.kind === "loop");
  assert.deepEqual([loop.text, loop.line, loop.endLine], ["for item in items:", 4, 4]);
  assert.deepEqual([loop.reads, loop.writes], [["items"], ["item"]]);
});

test("the core lays the graph out top to bottom and frames it", async () => {
  const g = await (await algorithm("shapes.drain")).json();
  const at = new Map<string, Rect>(g.rects.map((r: Rect) => [r.id, r]));
  const idOf = (label: string) => g.steps.find((s: Step) => s.label === label).id;
  assert.deepEqual(at.get(idOf("while total > 100")), { id: idOf("while total > 100"), x: 0, y: 84, width: 240, height: 44 });
  assert.deepEqual(at.get(idOf("return total")), { id: idOf("return total"), x: 280, y: 168, width: 240, height: 44 });
  for (const e of g.edges.filter((e: Edge) => !e.back)) assert.ok(at.get(e.to)!.y > at.get(e.from)!.y);
  assert.deepEqual(g.frame, { x: -24, y: -24, width: 568, height: 344 });
});

test("asking for an Algorithm graph with bad input gives clear errors", async () => {
  const project = encodeURIComponent(fixture("flow"));
  assert.equal((await t.get("/algorithm")).status, 400);
  assert.equal((await t.get(`/algorithm?project=${project}`)).status, 400);
  assert.equal((await t.get(`/algorithm?project=${encodeURIComponent(fixture("flow") + "-never-opened")}&node=x`)).status, 404);
  assert.equal((await algorithm("shapes.nope")).status, 404);
  const notAFunction = await algorithm("shapes.Scorer");
  assert.equal(notAFunction.status, 422);
  assert.match((await notAFunction.json()).error, /function/);
});
