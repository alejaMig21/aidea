import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const project = fixture("playback-shapes");
before(async () => {
  t = await startTestCore();
  await t.post("/projects", { path: project });
});
after(() => t.core.close());

// The shapes of the locals at the last visit (the end step), and the whole recording.
const play = async (node: string, body: Record<string, unknown> = {}) => {
  const res = await t.post("/playback", { project, node, ...body });
  assert.equal(res.status, 201);
  const rec = await res.json();
  return { rec, last: rec.visits[rec.visits.length - 1].shapes as Record<string, any> };
};

test("a list is recorded as a sequence with its items, next to the unchanged text", async () => {
  const { rec, last } = await play("shapes.make_list");
  assert.equal(rec.visits[rec.visits.length - 1].locals.items, "[1, 'two', 3.5]");
  const { changed, id, ...items } = last.items;
  assert.equal(typeof id, "number");
  assert.deepEqual(items, {
    kind: "seq",
    type: "list",
    len: 3,
    hidden: 0,
    items: [
      { kind: "scalar", type: "int", value: 1 },
      { kind: "scalar", type: "str", value: "two" },
      { kind: "scalar", type: "float", value: 3.5 },
    ],
  });
});

test("a dictionary is recorded as entries of key and value shapes", async () => {
  const { last } = await play("shapes.make_dict");
  const { entries, kind, len, hidden } = last.table;
  assert.deepEqual({ kind, len, hidden }, { kind: "map", len: 3, hidden: 0 });
  assert.deepEqual(entries[2], [{ kind: "scalar", type: "int", value: 7 }, { kind: "scalar", type: "str", value: "seven" }]);
  const nested = entries[1][1];
  assert.equal(nested.kind, "map");
  assert.equal(nested.entries[0][1].items[0].value, true);
  assert.equal(nested.entries[0][1].items[1].value, null);
});

test("linked objects with a cycle end in a reference to the object already described", async () => {
  const { last } = await play("shapes.make_cycle");
  const first = last.first;
  assert.equal(first.kind, "object");
  assert.equal(first.type, "Node");
  assert.equal(first.fields.name.value, "first");
  const second = first.fields.next;
  assert.equal(second.kind, "object");
  assert.deepEqual(second.fields.next, { kind: "ref", id: first.id }); // first -> second -> first
  assert.deepEqual(last.second, { kind: "ref", id: second.id }); // already described inside `first`
});

test("a tree is nested shapes, and an object seen from two variables is described once and referred to once", async () => {
  const tree = (await play("shapes.make_tree")).last.tree;
  assert.equal(tree.entries[0][1].entries[0][1].value, null);
  assert.deepEqual(tree.entries[1][1].items.map((i: any) => i.value), [1, 2]);

  const { last } = await play("shapes.make_alias");
  const shared = last.shared; // met first, so described here
  assert.equal(shared.kind, "seq");
  assert.deepEqual(last.holder.entries[0][1], { kind: "ref", id: shared.id }); // holder["p"] and other["q"] are that one list
  assert.deepEqual(last.other.entries[0][1], { kind: "ref", id: shared.id });
});

test("a huge list is cut at the item limit and says how many items are hidden", async () => {
  const { last } = await play("shapes.make_huge");
  assert.equal(last.big.len, 10000);
  assert.equal(last.big.hidden, 9900);
  assert.equal(last.big.items.length, 100);
});

test("an open file and a lambda are opaque boxes with a type label", async () => {
  const { last } = await play("shapes.make_opaque");
  assert.deepEqual(last.f, { kind: "opaque", type: "StringIO" });
  assert.deepEqual(last.g, { kind: "opaque", type: "function" });
});

test("nan, inf and integers beyond what JSON.parse keeps exactly are sent as tagged text", async () => {
  const { last } = await play("shapes.make_floats");
  assert.deepEqual(last.x, { kind: "scalar", type: "float", value: "nan", tag: "float" });
  assert.deepEqual(last.y, { kind: "scalar", type: "float", value: "inf", tag: "float" });
  assert.deepEqual(last.z, { kind: "scalar", type: "int", value: String(2n ** 80n), tag: "int" });
});

test("fields come from __slots__ too, and a slot never set is left out", async () => {
  const { last } = await play("shapes.make_slots");
  assert.deepEqual(Object.keys(last.s.fields), ["a"]);
  assert.equal(last.s.fields.a.value, 1);
});

test("recording never calls repr, a property or __getattr__ of the person's object", async () => {
  const { rec, last } = await play("shapes.make_loud");
  assert.equal(rec.error, undefined);
  assert.equal(last.loud.kind, "object");
  assert.deepEqual(last.loud.fields, {});
  // the fixture records each call; only the text form (`short`) may ask for repr
  assert.deepEqual([...new Set(last.calls.items.map((i: any) => i.value))], ["repr:short"]);
});

test("a user-defined __class__ is not run to decide what a value is", async () => {
  const { rec, last } = await play("shapes.make_sneaky");
  assert.equal(rec.error, undefined);
  assert.equal(last.sneaky.kind, "object");
  assert.equal(last.sneaky.type, "Sneaky");
  assert.equal(last.calls.len, 0);
});

test("an int with thousands of digits is tagged without being turned into text, and the run goes on", async () => {
  const { rec, last } = await play("shapes.make_big_int");
  assert.equal(rec.error, undefined);
  assert.equal(rec.result, "1");
  assert.equal(last.n.tag, "int");
  assert.equal(last.n.digits, 5001);
  assert.ok(last.n.value.startsWith("1000000000") && last.n.value.length < 40);
});

test("a huge string is cut with a count of what is hidden", async () => {
  const { last } = await play("shapes.make_big_string");
  assert.ok(last.s.value.length <= 80);
  assert.equal(last.s.hidden, 10_000_000 - 79);
});

test("a failure while shaping drops the shapes of that visit and leaves the run alone", async () => {
  const { rec } = await play("shapes.make_weird");
  assert.equal(rec.error, undefined);
  assert.equal(rec.result, "1");
  const last = rec.visits[rec.visits.length - 1];
  assert.equal(last.shapes, undefined);
  assert.match(last.locals.w, /Weird/);
  assert.ok(rec.visits[0].shapes); // the visits before the failing value keep theirs
});

test("a list of a million numbers is shaped from its length and first items, not copied on every visit", async () => {
  const started = Date.now();
  const { rec, last } = await play("shapes.make_big_list");
  assert.ok(Date.now() - started < 2500);
  assert.equal(last.big.len, 1_000_000);
  assert.equal(last.big.hidden, 999_900);
  assert.equal(rec.visits.filter((v: any) => v.shapes).length, rec.visits.length);
});

test("cut stubs spend the node budget, so a wide structure stays small and every container accounts for its items", async () => {
  const { last } = await play("shapes.make_grid");
  assert.ok(JSON.stringify(last).length < 60_000);
  assert.equal(last.grid.len, 200);
  const check = (node: any) => {
    const children = node.items ?? node.entries?.map((e: any) => e[1]);
    if (!children) return;
    assert.equal(children.length + node.hidden, node.len);
    children.forEach(check);
  };
  check(last.grid);
});

test("tuples and frozensets are described in place, so two empty ones are not references; a list seen twice still is", async () => {
  const { last } = await play("shapes.make_singletons");
  for (const name of ["a", "b"]) assert.deepEqual([last[name].kind, last[name].type, last[name].len], ["seq", "tuple", 0]);
  for (const name of ["c", "d"]) assert.deepEqual([last[name].kind, last[name].type, last[name].len], ["seq", "frozenset", 0]);
  assert.equal(last.x.kind, "seq");
  assert.deepEqual(last.y, { kind: "ref", id: last.x.id });
});

test("a reference only points to an object that was described; a cut stub gives its id and the object is described later", async () => {
  const { last } = await play("shapes.make_cut_ref");
  let node = last.deep;
  while (node.kind === "seq") node = node.items[0];
  assert.equal(node.kind, "cut");
  assert.equal(typeof node.id, "number");
  assert.equal(last.mid.kind, "seq"); // described in full, not a ref to the stub
  assert.equal(last.mid.id, node.id);
});

test("an int or str subclass is its plain value with its type name", async () => {
  const { last } = await play("shapes.make_enums");
  assert.deepEqual(last.level, { kind: "scalar", type: "Level", value: 2 });
  assert.deepEqual(last.color, { kind: "scalar", type: "Color", value: "red" });
});

test("a name-mangled __slots__ name is found and shown as written", async () => {
  const { last } = await play("shapes.make_private");
  assert.deepEqual(Object.keys(last.p.fields), ["__x"]);
  assert.equal(last.p.fields.__x.value, 3);
});

test("a subclassed list is read through the built-in list, not through the person's __iter__ or __len__", async () => {
  const { rec, last } = await play("shapes.make_subclass_and_keys");
  assert.equal(rec.error, undefined);
  assert.deepEqual([last.mine.type, last.mine.len, last.mine.items.length], ["Mine", 2, 2]);
});

test("dictionary keys that are nested tuples or objects of any hash, and unhashable items in a list, are shaped", async () => {
  const { last } = await play("shapes.make_subclass_and_keys");
  assert.equal(last.table.entries[0][0].kind, "seq");
  assert.equal(last.table.entries[0][0].items[1].items[1].value, 3);
  assert.equal(last.table.entries[1][0].type, "Odd");
  assert.deepEqual(last.pool.items.map((i: any) => i.kind), ["object", "seq"]);
});

test("the objects kept for stable ids are capped; past the cap shapes stop and the recording says so", async () => {
  const { rec } = await play("shapes.make_many_objects");
  assert.equal(rec.shapesTruncated, true);
  const withShapes = rec.visits.filter((v: any) => v.shapes).length;
  assert.ok(withShapes > 0 && withShapes < rec.visits.length);
  assert.equal(rec.result, "1");
});

test("depth and a node budget cut the shape and say so, never silently", async () => {
  const { last: deep } = await play("shapes.make_deep");
  let node = deep.deep;
  for (let i = 0; i < 6; i++) node = node.items[0]; // six levels are described
  assert.equal(node.kind, "cut");
  assert.equal(node.reason, "depth");
  assert.equal(node.len, 1);

  const { last: wide } = await play("shapes.make_wide");
  assert.match(JSON.stringify(wide), /"reason":"nodes"/); // more than 500 nodes end in cuts that name the budget
});

test("each local says whether it changed since the previous visit, and an object keeps its id across visits", async () => {
  const { rec } = await play("shapes.mutate");
  const changed = rec.visits.map((v: any) => Object.fromEntries(Object.entries(v.shapes).map(([k, s]: [string, any]) => [k, s.changed === true])));
  // visits: start, items = [1], count = 0, items.append(2), count += 0, return, end
  assert.deepEqual(changed.slice(2, 6), [{ items: true }, { items: false, count: true }, { items: true, count: false }, { items: false, count: false }]);
  assert.equal(rec.visits[2].shapes.items.id, rec.visits[5].shapes.items.id);
  assert.equal(rec.visits[5].shapes.items.len, 2);
});

test("a recording past its byte budget is marked, keeps its text and stops growing", async () => {
  const { rec } = await play("shapes.many_visits");
  assert.equal(rec.shapesTruncated, true);
  const withShapes = rec.visits.filter((v: any) => v.shapes);
  assert.ok(withShapes.length > 0 && withShapes.length < rec.visits.length);
  assert.ok(JSON.stringify(withShapes).length < 5_000_000);
  assert.ok(rec.visits.every((v: any) => typeof v.locals === "object"));
  assert.equal(rec.result, "1");
});

test("a recording of an ordinary function is not marked as cut short", async () => {
  const { rec } = await play("shapes.make_list");
  assert.equal(rec.shapesTruncated, undefined);
});
