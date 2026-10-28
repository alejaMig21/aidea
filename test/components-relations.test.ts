import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { CoreNode, Relationship } from "../src/core/types.ts";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
before(async () => {
  t = await startTestCore();
});
after(() => t.core.close());

const open = async (name: string) => (await t.post("/projects", { path: fixture(name) })).json();
const rels = (p: { relationships: Relationship[] }, kind: Relationship["kind"], from?: string) =>
  p.relationships.filter((r) => r.kind === kind && (from === undefined || r.from === from));

test("inheritance between Project classes is resolved and an outside base is flagged external", async () => {
  const p = await open("relations");
  const inherits = rels(p, "inherits");
  assert.ok(inherits.some((r) => r.from === "shapes.Circle" && r.to === "shapes.Shape" && r.resolution === "resolved" && !r.external));
  assert.ok(inherits.some((r) => r.from === "shapes.Square" && r.to === "shapes.Shape"));
  const mixin = inherits.find((r) => r.from === "shapes.Square" && r.name === "Mixin");
  assert.ok(mixin && mixin.to === null && mixin.external === true && mixin.resolution === "resolved");
  const abc = inherits.find((r) => r.from === "shapes.Shape");
  assert.ok(abc && abc.external === true && abc.name === "ABC");
});

test("imports between Project modules carry the imported names, outside imports are left out", async () => {
  const p = await open("relations");
  const imports = rels(p, "imports");
  const fromUtil = imports.find((r) => r.from === "shapes" && r.to === "util");
  assert.deepEqual(fromUtil && { names: fromUtil.names, resolution: fromUtil.resolution }, { names: ["helper"], resolution: "resolved" });
  assert.deepEqual(imports.find((r) => r.from === "render" && r.to === "shapes" && r.names)?.names, ["Circle", "Square"]);
  assert.ok(imports.some((r) => r.from === "render" && r.to === "util" && r.names === undefined));
  assert.ok(!imports.some((r) => r.to === null || r.name === "external_lib"));
});

test("a direct call to a Project function or a method on self is resolved", async () => {
  const p = await open("relations");
  const calls = rels(p, "calls");
  const has = (from: string, to: string) => calls.some((r) => r.from === from && r.to === to && r.resolution === "resolved");
  assert.ok(has("shapes.Circle.area", "util.helper"));
  assert.ok(has("shapes.Shape.describe", "shapes.Shape.area"));
  assert.ok(has("render.make", "util.scale"));
  assert.ok(has("render.make", "shapes.Shape.unit"));
  assert.ok(has("render.make", "shapes.Circle")); // a class without its own __init__: the class itself
  assert.ok(has("util.scale", "util.helper"));
});

test("a call matched only by a method name that several classes define is inferred, one relationship per candidate", async () => {
  const p = await open("relations");
  const draw = rels(p, "calls", "render.draw");
  assert.deepEqual(draw.map((r) => r.to).sort(), ["shapes.Circle.area", "shapes.Shape.area", "shapes.Square.area"]);
  assert.ok(draw.every((r) => r.resolution === "inferred" && r.name === "area"));
});

test("getattr and callables held in variables are unresolved and still reported", async () => {
  const p = await open("relations");
  for (const [from, name] of [["render.pick", "getattr"], ["render.run", "callback"], ["render.go", "handler"]]) {
    const r = rels(p, "calls", from).filter((x) => x.resolution === "unresolved");
    assert.equal(r.length, 1, from);
    assert.equal(r[0]!.to, null);
    assert.equal(r[0]!.name, name);
  }
});

test("the response counts the unresolved relationships", async () => {
  const p = await open("relations");
  const count = p.relationships.filter((r: Relationship) => r.resolution === "unresolved").length;
  assert.equal(p.unresolved, count);
  assert.equal(count, 3);
});

test("members carry visibility, static, abstract and property markers", async () => {
  const p = await open("relations");
  const nodes = p.nodes as CoreNode[];
  const m = (id: string) => nodes.find((n) => n.id === id)!.markers;
  assert.deepEqual(m("shapes.Shape.area"), { visibility: "public", abstract: true });
  assert.deepEqual(m("shapes.Shape.label"), { visibility: "public", property: true });
  assert.deepEqual(m("shapes.Shape.unit"), { visibility: "public", static: true });
  assert.deepEqual(m("shapes.Shape._hidden"), { visibility: "private" });
  assert.deepEqual(m("shapes.Shape.__len__"), { visibility: "special" });
  assert.deepEqual(m("shapes.Shape"), { visibility: "public", abstract: true });
  assert.deepEqual(m("shapes.Circle"), { visibility: "public" });
  assert.deepEqual(nodes.find((n) => n.id === "shapes.Shape")!.attributeVisibility, { name: "public", _cache: "private" });
});

test("earlier outline fields keep working and a Project without dynamic calls reports none unresolved", async () => {
  const p = await open("shop");
  assert.equal(p.unresolved, 0);
  const cart = p.nodes.find((n: CoreNode) => n.id === "cart.Cart");
  assert.ok(cart.attributes && cart.line === 1);
});
