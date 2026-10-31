import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTestCore } from "./helpers.ts";
import { layered } from "../src/core/layered.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const scratch = mkdtempSync(join(tmpdir(), "aidea-engine-"));
before(async () => {
  t = await startTestCore();
});
after(() => {
  t.core.close();
  rmSync(scratch, { recursive: true, force: true });
});

type Rect = { id: string; x: number; y: number; width: number; height: number };
type Point = { x: number; y: number };
type Route = { from: string; to: string; points: Point[]; label?: { text: string; x: number; y: number } };
type Step = { id: string; label: string };
type Edge = { from: string; to: string; label?: string; back?: boolean };
type Graph = { steps: Step[]; edges: Edge[]; rects: Rect[]; routes: Route[] };

// Writes a Python file as its own Project and asks for the Algorithm graph of one function.
let projectCount = 0;
async function graphOf(source: string, name: string): Promise<Graph> {
  const dir = join(scratch, `p${projectCount++}`);
  mkdirSync(dir);
  writeFileSync(join(dir, "m.py"), source);
  const opened = await t.post("/projects", { path: dir });
  assert.ok(opened.ok);
  const res = await t.get(`/flow?project=${encodeURIComponent(dir)}&node=${encodeURIComponent("m." + name)}`);
  assert.equal(res.status, 200);
  return res.json();
}

const rectOf = (g: { steps: Step[]; rects: Rect[] }, label: string) => {
  const step = g.steps.find((s) => s.label === label);
  assert.ok(step, `no step labelled ${label}`);
  return g.rects.find((r) => r.id === step.id)!;
};

// Every promise of the layout, checked on any graph.
function assertSound(g: { rects: Rect[]; routes: Route[]; edges: Edge[] }) {
  assert.equal(g.routes.length, g.edges.length, "one route per edge");
  for (let i = 0; i < g.rects.length; i++) {
    for (let j = i + 1; j < g.rects.length; j++) {
      const a = g.rects[i], b = g.rects[j];
      const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;
      assert.ok(apart, `${a.id} overlaps ${b.id}`);
    }
  }
  for (const route of g.routes) {
    assert.ok(route.points.length >= 2);
    route.points.slice(1).forEach((p, i) => {
      const q = route.points[i];
      assert.ok(p.x === q.x || p.y === q.y, `diagonal segment in ${route.from} -> ${route.to}`);
      const [x1, x2, y1, y2] = [Math.min(p.x, q.x), Math.max(p.x, q.x), Math.min(p.y, q.y), Math.max(p.y, q.y)];
      for (const r of g.rects) {
        const inside = x2 > r.x && x1 < r.x + r.width && y2 > r.y && y1 < r.y + r.height;
        assert.ok(!inside, `${route.from} -> ${route.to} passes through ${r.id}`);
      }
    });
  }
}

test("laying out the same function twice gives identical rectangles and routes", async () => {
  const src = "def f(xs):\n    t = 0\n    for x in xs:\n        if x > 1:\n            t += x\n    return t\n";
  const a = await graphOf(src, "f");
  const b = await graphOf(src, "f");
  assert.deepEqual(a.rects, b.rects);
  assert.deepEqual(a.routes, b.routes);
  assert.ok(a.routes.every((r) => r.points.length >= 2));
  assertSound(a);
});

test("a straight function keeps its steps in one column", async () => {
  const g = await graphOf("def f(a):\n    b = a + 1\n    c = b + 1\n    return c\n", "f");
  assert.equal(new Set(g.rects.map((r) => r.x + r.width / 2)).size, 1); // one column: the centres line up
  assert.deepEqual(g.rects.map((r) => r.y), [...g.rects.map((r) => r.y)].sort((p, q) => p - q));
  assertSound(g);
});

test("an if puts its branches side by side and they rejoin below", async () => {
  const g = await graphOf("def f(a):\n    if a:\n        b = 1\n    else:\n        b = 2\n    return b\n", "f");
  const yes = rectOf(g, "b = 1"), no = rectOf(g, "b = 2"), join_ = rectOf(g, "return b"), test_ = rectOf(g, "if a");
  assert.equal(yes.y, no.y);
  assert.ok(yes.x + yes.width <= no.x, "true side on the left of the false side");
  assert.ok(join_.y > yes.y + yes.height);
  assert.ok(test_.y + test_.height <= yes.y);
  assertSound(g);
});

test("a loop's way back goes around its body, to the right of every body step", async () => {
  const g = await graphOf("def f(xs):\n    t = 0\n    for x in xs:\n        t += x\n        t -= 1\n    return t\n", "f");
  const loop = rectOf(g, "for x in xs"), last = rectOf(g, "t -= 1");
  const index = g.edges.findIndex((e) => e.back);
  const way = g.routes[index].points;
  const lane = Math.max(...way.map((p) => p.x));
  assert.ok(lane > Math.max(...g.rects.map((r) => r.x + r.width)));
  assert.ok(Math.min(...way.map((p) => p.y)) <= loop.y + loop.height, "reaches back up to the loop step");
  assert.ok(Math.max(...way.map((p) => p.y)) >= last.y, "starts at the last body step");
  assertSound(g);
});

const elbows = (points: Point[]) => points.length - 2;
const loopSources: Record<string, string> = {
  for: "def f(xs):\n    t = 0\n    for x in xs:\n        t += x\n    return t\n",
  while: "def f(n):\n    while n > 100:\n        n -= 10\n    return n\n",
  nested: "def f(xs):\n    t = 0\n    for a in xs:\n        for b in xs:\n            t += b\n    return t\n",
  "for with an if": "def f(xs):\n    t = 0\n    for x in xs:\n        if x > 1:\n            t += x\n    return t\n",
  "while with a break": "def f(xs):\n    while xs:\n        if xs[0]:\n            break\n        xs = xs[1:]\n    return 1\n",
};
for (const [name, src] of Object.entries(loopSources)) {
  test(`the exit of a ${name} loop leaves on the side that faces the next step, with few elbows and no node in the way`, async () => {
    const g = await graphOf(src, "f");
    assertSound(g);
    let tested = 0;
    for (const head of g.steps.filter((s) => g.edges.some((e) => e.back && e.to === s.id))) {
      const rect = g.rects.find((r) => r.id === head.id)!;
      const index = g.edges.findIndex((e) => e.from === head.id && !e.back && /^(done|no)$/.test((e as Edge & { exit?: string }).exit ?? ""));
      if (index < 0) continue; // an inner loop whose exit is the outer loop's way back has no forward exit
      tested++;
      const way = g.routes[index].points, target = g.rects.find((r) => r.id === g.edges[index].to)!;
      const faces = target.x + target.width / 2 > rect.x + rect.width / 2 ? rect.x + rect.width : rect.x;
      assert.equal(way[0].x, faces, `${head.label}: the exit starts on the side facing the next step`);
      assert.equal(way[0].y, rect.y + rect.height / 2, `${head.label}: at the middle of that side`);
      assert.ok(elbows(way) <= 3, `${head.label}: ${elbows(way)} elbows`);
      for (const back of g.routes.filter((_, i) => g.edges[i].back && g.edges[i].to === head.id)) {
        const end = back.points.at(-1)!;
        assert.ok(end.x !== way[0].x || end.y !== way[0].y, "a way back does not enter where the exit leaves");
      }
    }
    assert.ok(tested >= 1);
    assert.deepEqual((await graphOf(src, "f")).routes, g.routes); // deterministic
  });
}

test("edge labels get room: no label overlaps a step", async () => {
  const g = await graphOf("def f(xs):\n    for x in xs:\n        if x:\n            continue\n        print(x)\n    return 1\n", "f");
  const labelled = g.routes.filter((r) => r.label);
  assert.ok(labelled.length >= 3);
  for (const r of labelled) {
    const l = r.label!;
    const [x1, x2, y1, y2] = [l.x, l.x + 6.5 * l.text.length, l.y - 11, l.y + 2];
    for (const s of g.rects) assert.ok(!(x2 > s.x && x1 < s.x + s.width && y2 > s.y && y1 < s.y + s.height), `label ${l.text} covers ${s.id}`);
  }
  assertSound(g);
});

// A function with nested loops, branches, a break and a continue, repeated to make it big.
const big = (blocks: number) =>
  "def big(xs):\n    total = 0\n" +
  Array.from({ length: blocks }, () =>
    [
      "    for a in xs:",
      "        for b in xs:",
      "            if a > b:",
      "                total += 1",
      "            elif a == b:",
      "                total += 2",
      "            else:",
      "                total -= 1",
      "            while total > 100:",
      "                total -= 10",
      "        if total < 0:",
      "            continue",
      "        if total == 7:",
      "            break",
      "        total += a",
    ].join("\n"),
  ).join("\n") +
  "\n    return total\n";

test("a larger function with nested loops and branches is laid out soundly, in under a second", async () => {
  const g = await graphOf(big(10), "big");
  assert.ok(g.steps.length > 100);
  assertSound(g);
  const nodes = g.rects.map((r) => ({ id: r.id, width: r.width, height: r.height }));
  const started = performance.now();
  const out = layered(nodes, g.edges);
  assert.ok(performance.now() - started < 1000);
  assert.deepEqual(out.rects, g.rects);
});

test("the engine ignores input order and survives a cycle among forward edges", () => {
  const nodes = ["a", "b", "c", "d"].map((id) => ({ id, width: 100, height: 40 }));
  const edges = [{ from: "a", to: "b" }, { from: "b", to: "c" }, { from: "c", to: "d" }, { from: "d", to: "b" }];
  const one = layered(nodes, edges);
  const two = layered([...nodes].reverse(), [...edges].reverse());
  const byId = (r: Rect[]) => [...r].sort((p, q) => p.id.localeCompare(q.id));
  assert.deepEqual(byId(one.rects), byId(two.rects));
  assertSound({ rects: one.rects, routes: one.routes, edges });
});

test("a group is a box that holds all its children with a margin, and leaves other steps outside", () => {
  const nodes = ["top", "a", "b", "c", "other", "bottom"].map((id) => ({ id, width: 100, height: 40 }));
  const edges = [
    { from: "top", to: "a" }, { from: "top", to: "other" }, { from: "a", to: "b" }, { from: "a", to: "c" },
    { from: "b", to: "bottom" }, { from: "c", to: "bottom" }, { from: "other", to: "bottom" },
  ];
  const out = layered(nodes, edges, [{ id: "box", children: ["a", "b", "c"] }]);
  assert.equal(out.groups.length, 1);
  const box = out.groups[0];
  assert.equal(box.id, "box");
  for (const id of ["a", "b", "c"]) {
    const r = out.rects.find((x) => x.id === id)!;
    assert.ok(r.x - box.x >= 16 && r.y - box.y >= 16 && box.x + box.width - (r.x + r.width) >= 16 && box.y + box.height - (r.y + r.height) >= 16, `${id} inside with margin`);
  }
  for (const id of ["top", "other", "bottom"]) {
    const r = out.rects.find((x) => x.id === id)!;
    const apart = r.x + r.width <= box.x || box.x + box.width <= r.x || r.y + r.height <= box.y || box.y + box.height <= r.y;
    assert.ok(apart, `${id} outside the box`);
  }
  assertSound({ rects: out.rects, routes: out.routes, edges });
});
