import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { CoreNode } from "../src/core/types.ts";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
before(async () => {
  t = await startTestCore();
});
after(() => t.core.close());

type R = { id: string; x: number; y: number; width: number; height: number };
type P = { x: number; y: number };
type Route = { kind: string; resolution: string; from: string; to: string | null; name: string; points: P[]; label?: { text: string }; external?: true };
type Layout = { rects: R[]; compartments: Record<string, { attributes: number; methods: number }>; routes: Route[] };

async function layout(name: string): Promise<{ nodes: CoreNode[]; body: Layout }> {
  const project = await (await t.post("/projects", { path: fixture(name) })).json();
  const res = await t.get(`/layout?project=${encodeURIComponent(fixture(name))}&layer=components`);
  assert.equal(res.status, 200);
  return { nodes: project.nodes, body: await res.json() };
}

const inside = (a: R, b: R) => a.x >= b.x && a.y >= b.y && a.x + a.width <= b.x + b.width && a.y + a.height <= b.y + b.height;
const apart = (a: R, b: R) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

test("every Node keeps a rectangle under its id and attribute rows keep their `<class>#<name>` ids", async () => {
  const { nodes, body } = await layout("members");
  const ids = new Set(body.rects.map((r) => r.id));
  for (const n of nodes) assert.ok(ids.has(n.id), `${n.id} has a rectangle`);
  for (const a of ["kind", "limit", "owner", "balance"]) assert.ok(ids.has(`models.Account#${a}`), a);
});

test("a class is a box inside its package with name, attributes and methods compartments sized by their members", async () => {
  const { body } = await layout("relations");
  const at = (id: string) => body.rects.find((r) => r.id === id)!;
  const shape = at("shapes.Shape"), circle = at("shapes.Circle"), pkg = at("shapes");
  assert.ok(inside(shape, pkg) && inside(circle, pkg));
  assert.ok(shape.y > pkg.y, "the package keeps a header (its tab) above the classes");
  // Shape has 2 attributes and 7 methods, Circle has 1 method: the heights follow the member counts.
  assert.ok(shape.height > circle.height + 5 * 20);
  const c = body.compartments["shapes.Shape"];
  assert.ok(c.attributes > shape.y && c.attributes < c.methods && c.methods < shape.y + shape.height);
  for (const a of ["name", "_cache"]) {
    const row = at(`shapes.Shape#${a}`);
    assert.ok(row.y >= c.attributes && row.y + row.height <= c.methods, `${a} sits in the attributes compartment`);
    assert.ok(inside(row, shape));
  }
  const methods = ["__init__", "area", "label", "unit", "describe", "_hidden", "__len__"].map((m) => at(`shapes.Shape.${m}`));
  for (const m of methods) assert.ok(m.y >= c.methods && inside(m, shape), "a method sits in the methods compartment");
  for (let i = 0; i < methods.length; i++) for (let j = i + 1; j < methods.length; j++) assert.ok(apart(methods[i], methods[j]));
});

test("packages stand in columns, boxes never overlap and everything stays in its package", async () => {
  const { nodes, body } = await layout("relations");
  const at = new Map(body.rects.map((r) => [r.id, r]));
  const packages = nodes.filter((n) => n.kind === "module").map((n) => at.get(n.id)!);
  for (let i = 0; i < packages.length; i++) for (let j = i + 1; j < packages.length; j++) assert.ok(apart(packages[i], packages[j]));
  assert.equal(new Set(packages.map((p) => p.y)).size, 1, "one row of packages: they stand in columns");
  const boxes = nodes.filter((n) => n.kind === "class" || (n.kind === "function" && n.parent && nodes.find((m) => m.id === n.parent)?.kind === "module"));
  for (const b of boxes) assert.ok(inside(at.get(b.id)!, at.get(b.parent!)!), `${b.id} inside ${b.parent}`);
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(apart(at.get(boxes[i].id)!, at.get(boxes[j].id)!), `${boxes[i].id} / ${boxes[j].id}`);
});

test("the same Project gives identical rectangles and routes every time", async () => {
  const first = await layout("relations");
  const second = await layout("relations");
  assert.deepEqual(second.body, first.body);
  assert.ok(first.body.routes.length > 0);
});

test("relationships between boxes get routes: orthogonal, from the source box to the target box, through no other box", async () => {
  const { nodes, body } = await layout("relations");
  const at = new Map(body.rects.map((r) => [r.id, r]));
  const boxIds = nodes.filter((n) => n.kind === "class" || (n.kind === "function" && nodes.find((m) => m.id === n.parent)?.kind === "module")).map((n) => n.id);
  const edge = (p: P, r: R) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
  const between = body.routes.filter((r) => r.to !== null);
  assert.ok(between.some((r) => r.kind === "inherits" && r.from === "shapes.Circle" && r.to === "shapes.Shape" && r.resolution === "resolved"));
  assert.ok(between.some((r) => r.kind === "imports" && r.from === "shapes" && r.to === "util"));
  assert.ok(between.some((r) => r.kind === "calls"));
  for (const r of between) {
    assert.ok(r.points.length >= 2);
    assert.ok(edge(r.points[0], at.get(r.from)!) && edge(r.points.at(-1)!, at.get(r.to!)!), `${r.kind} ${r.from}->${r.to} touches both ends`);
    for (let i = 1; i < r.points.length; i++) {
      const a = r.points[i - 1], b = r.points[i];
      assert.ok(a.x === b.x || a.y === b.y, "horizontal or vertical segments only");
      for (const id of boxIds) {
        if (id === r.from || id === r.to) continue;
        const box = at.get(id)!;
        const crosses = Math.max(a.x, b.x) > box.x && Math.min(a.x, b.x) < box.x + box.width && Math.max(a.y, b.y) > box.y && Math.min(a.y, b.y) < box.y + box.height;
        assert.ok(!crosses, `${r.kind} ${r.from}->${r.to} runs through ${id}`);
      }
    }
  }
  assert.equal(body.routes.find((r) => r.kind === "imports")!.label?.text, "import");
});

test("a relationship with no Project target is a short stub out of its source and keeps its resolution", async () => {
  const { body } = await layout("relations");
  const stubs = body.routes.filter((r) => r.to === null);
  const abc = stubs.find((r) => r.kind === "inherits" && r.name === "ABC");
  assert.ok(abc && abc.external === true && abc.resolution === "resolved" && abc.from === "shapes.Shape");
  const getattr = stubs.find((r) => r.name === "getattr");
  assert.ok(getattr && getattr.resolution === "unresolved");
  assert.ok(stubs.every((r) => r.points.length === 2 && r.points[0].y === r.points[1].y));
});
