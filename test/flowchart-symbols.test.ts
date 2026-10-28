import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
before(async () => {
  t = await startTestCore();
  await t.post("/projects", { path: fixture("flow") });
});
after(() => t.core.close());

type Step = {
  id: string; kind: string; label: string; construct: string; generic?: boolean; io?: string | null; finally?: boolean;
  exits: string[]; exception?: string; lines: string[];
};
type Edge = { from: string; to: string; label?: string; exit?: string; exception?: string; back?: boolean };
type Rect = { id: string; x: number; y: number; width: number; height: number };

async function tour() {
  const res = await t.get(`/algorithm?project=${encodeURIComponent(fixture("flow"))}&node=symbols.tour`);
  assert.equal(res.status, 200);
  const g = (await res.json()) as { steps: Step[]; edges: Edge[]; rects: Rect[] };
  const step = (label: string) => {
    const found = g.steps.find((s) => s.label === label);
    assert.ok(found, `no step labelled ${label}`);
    return found;
  };
  return { g, step };
}

test("every step names its construct and lists its labelled exits", async () => {
  const { g, step } = await tour();
  for (const s of g.steps) {
    assert.equal(typeof s.construct, "string", s.label);
    assert.ok(Array.isArray(s.exits), s.label);
  }
  assert.equal(step("for item in items").construct, "for");
  assert.deepEqual(step("for item in items").exits, ["next item", "done"]);
  assert.equal(step("while total > 10").construct, "while");
  assert.deepEqual(step("while total > 10").exits, ["yes", "no"]);
  assert.deepEqual(step("if item < 0").exits, ["Yes", "No"]);
  assert.equal(step("total = 0").construct, "assign");
});

test("a match has one exit per pattern and each edge carries its exit", async () => {
  const { g, step } = await tour();
  const match = step("match mode");
  assert.equal(match.construct, "match");
  assert.deepEqual(match.exits, ["'fast'", "'slow' | 'lazy'", "_"]);
  const fast = step("case 'fast'");
  assert.equal(fast.construct, "case");
  const out = g.edges.filter((e) => e.from === fast.id).map((e) => e.exit).sort();
  assert.deepEqual(out, ["'fast'", "no match"]);
  const yes = g.edges.find((e) => e.from === step("if item < 0").id && e.label === "true");
  assert.equal(yes?.exit, "Yes");
});

test("calls to the known input and output functions carry an io flag", async () => {
  const { step } = await tour();
  assert.equal(step("name = input('name? ')").io, "input");
  assert.equal(step("print('total', total)").io, "output");
  assert.equal(step("data = open(path)").io, "input");
  assert.equal(step("print('done')").io, "output");
  assert.ok(!step("total = 0").io);
  assert.ok(!step("with open(path)").io); // a with is drawn as a with, not as input
});

test("exception edges carry the exception type, and handler steps say what they catch", async () => {
  const { g, step } = await tour();
  const caught = g.edges.filter((e) => e.label === "error").map((e) => e.exception).sort();
  assert.deepEqual(caught, ["(OSError, KeyError)", "ValueError"]);
  assert.ok(g.edges.filter((e) => e.label === "error").every((e) => e.exit === e.exception));
  assert.equal(step("except ValueError").exception, "ValueError");
  assert.equal(step("except ValueError").construct, "except");
  assert.equal(step("try").construct, "try");
  assert.ok(g.edges.filter((e) => e.label !== "error").every((e) => e.exception === undefined));
});

test("with, break, continue and finally are marked", async () => {
  const { step } = await tour();
  assert.equal(step("with open(path)").construct, "with");
  assert.equal(step("break").construct, "break");
  assert.equal(step("continue").construct, "continue");
  assert.equal(step("print('done')").finally, true);
  assert.ok(!step("print('total', total)").finally);
  assert.equal(step("raise").kind, "raise");
  assert.equal(step("return total").kind, "return");
});

test("a construct without a symbol is a generic step that names it", async () => {
  const { g, step } = await tour();
  const lambda = step("pick = lambda x: x + 1");
  assert.deepEqual([lambda.generic, lambda.construct], [true, "lambda"]);
  const comprehension = step("squares = [i * i for i in items]");
  assert.deepEqual([comprehension.generic, comprehension.construct], [true, "comprehension"]);
  const skip = step("pass");
  assert.deepEqual([skip.generic, skip.construct], [true, "pass"]);
  assert.ok(!step("total = 0").generic);
  assert.ok(g.steps.length >= 28); // nothing is omitted
});

test("diamonds and parallelograms are sized to fit their text, and nothing overlaps", async () => {
  const { g, step } = await tour();
  const rect = (s: Step) => g.rects.find((r) => r.id === s.id)!;
  assert.ok(rect(step("if item < 0")).height > rect(step("total = 0")).height, "a decision is taller than a process box");
  const longest = (s: Step) => Math.max(...s.lines.map((l) => l.length));
  for (const s of g.steps) {
    const factor = s.kind === "branch" || s.kind === "loop" ? 1.5 : 1;
    assert.ok(rect(s).width >= longest(s) * 6 * factor, `${s.label} is wide enough for its text`);
  }
  for (const a of g.rects) for (const b of g.rects) {
    if (a.id >= b.id) continue;
    const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
    assert.ok(apart, `${a.id} overlaps ${b.id}`);
  }
});
