import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const project = fixture("params");
const marker = join(project, "marker.txt");
before(async () => {
  t = await startTestCore();
});
after(() => {
  t.core.close();
  rmSync(marker, { force: true });
  rmSync(join(project, "y.txt"), { force: true });
});

type Param = { name: string; default?: string; annotation?: string; suggestion?: string };
const parametersOf = async (id: string): Promise<Param[]> => {
  const opened = await (await t.post("/projects", { path: project })).json();
  return opened.nodes.find((n: { id: string }) => n.id === id).parameters;
};
const play = (values: Record<string, string>, node = "funcs.echo") => t.post("/playback", { project, node, values });
const resultOf = async (value: string) => (await (await play({ x: value })).json()).result;

test("analysis reports a function's parameters in order with default and annotation", async () => {
  assert.deepEqual(await parametersOf("funcs.add"), [
    { name: "a", annotation: "int", suggestion: "1" },
    { name: "b", default: "2", suggestion: "2" },
    { name: "c", default: "1.5", annotation: "float", suggestion: "1.5" },
  ]);
  assert.deepEqual(await parametersOf("funcs.echo"), [{ name: "x" }]);
  assert.equal(await parametersOf("funcs.Box.put"), undefined, "methods are not part of this form");
});

test("suggestions come from the default, then the annotation, else none", async () => {
  const byName = Object.fromEntries((await parametersOf("funcs.shapes")).map((p) => [p.name, p]));
  assert.equal(byName.name.suggestion, '"text"');
  assert.equal(byName.flag.suggestion, "True");
  assert.equal(byName.items.suggestion, "[1, 2, 3]");
  assert.equal(byName.table.suggestion, '{"key": "value"}');
  assert.equal(byName.pair.suggestion, "(1, 2)");
  assert.equal(byName.other.suggestion, undefined);
  assert.equal(byName.plain.suggestion, undefined);
  assert.equal(byName.nothing.suggestion, "None");
  assert.equal(byName.call.default, "len('ab')");
  assert.equal(byName.call.suggestion, undefined, "a default that is not a literal is not suggested");
});

test("values are Python literals of each basic type", async () => {
  const cases: [string, string][] = [
    ["3", "3"], ["2.5", "2.5"], ['"hi"', "'hi'"], ["True", "True"], ["None", "None"],
    ["[1, 2, 3]", "[1, 2, 3]"], ['{"a": 1}', "{'a': 1}"], ["(1, 2)", "(1, 2)"], ["-4", "-4"],
  ];
  for (const [text, shown] of cases) assert.equal(await resultOf(text), shown, text);
});

test("a blank value uses the parameter's default; several values map to their parameters", async () => {
  const rec = await (await play({ a: "1", b: "", c: "" }, "funcs.add")).json();
  assert.equal(rec.result, "4.5"); // 1 + 2 + 1.5
  const pos = await (await play({ a: "1", b: "2" }, "funcs.positional")).json();
  assert.equal(pos.result, "(1, 2, 7)");
});

test("a malformed literal is reported against its own parameter", async () => {
  const res = await play({ a: "[1, 2", b: "3" }, "funcs.add");
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.match(body.error, /\ba\b/);
  assert.deepEqual(Object.keys(body.fields), ["a"]);
});

test("anything that is not a plain literal is refused naming the parameter, and is never run", async () => {
  const attempts = [
    `__import__("pathlib").Path("marker.txt").write_text("x")`,
    "marker",
    "1 + 2",
    "[i for i in range(3)]",
    "len('ab')",
    "(lambda: 1)()",
  ];
  for (const text of attempts) {
    const res = await play({ x: text });
    assert.equal(res.status, 422, text);
    const body = await res.json();
    assert.match(body.error, /\bx\b/, text);
    assert.deepEqual(Object.keys(body.fields), ["x"], text);
  }
  assert.equal(existsSync(marker), false);
});

test("an unknown parameter name is refused", async () => {
  const res = await play({ nope: "1" });
  assert.equal(res.status, 422);
  assert.match((await res.json()).error, /nope/);
});

test("limits and earlier guarantees still hold with values", async () => {
  assert.equal((await play({ x: "1".repeat(20_000) })).status, 400);
  assert.equal((await t.post("/playback", { project, node: "funcs.echo", values: [1] })).status, 400);
  assert.equal((await t.post("/playback", { project, node: "funcs.echo", values: { x: 1 } })).status, 400);
  const effect = await play({ name: '"y.txt"' }, "funcs.save");
  assert.equal(effect.status, 422);
  assert.deepEqual((await effect.json()).effects, [{ name: "open", line: 18 }]);
  assert.equal(existsSync(join(project, "y.txt")), false);
  const own = await t.post("/playback", { project, node: "funcs.echo", values: { x: "1" }, useProjectPython: true });
  assert.equal(own.status, 422);
  assert.match((await own.json()).error, /virtual environment/);
});
