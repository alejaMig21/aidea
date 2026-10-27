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
  assert.deepEqual(await parametersOf("funcs.Box.put"), [{ name: "item", default: "1", annotation: "int", suggestion: "1" }], "a method's own parameters leave out self");
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

const nodeOf = async (id: string) => {
  const opened = await (await t.post("/projects", { path: project })).json();
  return opened.nodes.find((n: { id: string }) => n.id === id);
};
const playMethod = (body: Record<string, unknown>) => t.post("/playback", { project, node: "funcs.Counter.bump", ...body });
const playLoad = (effects: Record<string, unknown>) => t.post("/playback", { project, node: "funcs.load", values: { name: '"any.txt"' }, effects });

test("analysis of a method also reports the constructor's parameters", async () => {
  assert.deepEqual((await nodeOf("funcs.Counter.bump")).constructorParameters, [
    { name: "start", annotation: "int", suggestion: "1" },
    { name: "step", default: "1", suggestion: "1" },
    { name: "tag", default: "'t'", annotation: "str", suggestion: "'t'" },
  ]);
  assert.deepEqual((await nodeOf("funcs.Bare.run")).constructorParameters, [], "no __init__ means no fields");
  assert.equal((await nodeOf("funcs.echo")).constructorParameters, undefined, "plain functions have none");
});

test("a method is played on an instance built from constructor literals", async () => {
  const rec = await (await playMethod({ instanceValues: { start: "10", step: "3" }, values: { times: "2" } })).json();
  assert.equal(rec.result, "16");
  const blank = await (await playMethod({ instanceValues: { start: "5", step: "" } })).json();
  assert.equal(blank.result, "6", "a blank constructor value uses its default");
});

test("a bad constructor value is reported on its own field and a non-literal is never run", async () => {
  const bad = await playMethod({ instanceValues: { start: "[1," } });
  assert.equal(bad.status, 422);
  assert.deepEqual(Object.keys((await bad.json()).fields), ["constructor.start"]);
  const attempt = await playMethod({ instanceValues: { start: `__import__("pathlib").Path("marker.txt").write_text("x")` } });
  assert.equal(attempt.status, 422);
  const body = await attempt.json();
  assert.deepEqual(Object.keys(body.fields), ["constructor.start"]);
  assert.match(body.error, /\bstart\b/);
  assert.equal(existsSync(marker), false);
  assert.equal((await playMethod({ instanceValues: { nope: "1" } })).status, 422);
});

test("analysis offers effect rows with a sample for each external call", async () => {
  assert.deepEqual((await nodeOf("funcs.load")).effects, [{ name: "open", suggestion: '"line one\\nline two"' }]);
  assert.deepEqual((await nodeOf("funcs.fetch")).effects, [{ name: "requests.get", suggestion: '{"status": 200}' }]);
  assert.equal((await nodeOf("funcs.echo")).effects, undefined);
});

test("effects data arrives as named rows of literals and is applied", async () => {
  const res = await playLoad({ open: '"a\\nb"' });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).result, "'a\\nb'");
});

test("a non-literal effect row is refused on its own row and never run", async () => {
  for (const row of [`__import__("pathlib").Path("marker.txt").write_text("x")`, "marker", "'a' + 'b'", '"unterminated']) {
    const res = await playLoad({ open: row });
    assert.equal(res.status, 422, row);
    assert.deepEqual(Object.keys((await res.json()).fields), ["effect:open"], row);
  }
  assert.equal(existsSync(marker), false);
});

test("limits still hold for the new inputs", async () => {
  assert.equal((await playMethod({ instanceValues: [1] })).status, 400);
  assert.equal((await playMethod({ instanceValues: { start: 1 } })).status, 400);
  assert.equal((await playMethod({ instanceValues: { start: "1".repeat(20_000) } })).status, 400);
  assert.equal((await playMethod({ effects: { "not a name!": "1" } })).status, 400);
  assert.equal((await playMethod({ effects: { open: 1 } })).status, 400);
  assert.equal((await playMethod({ effects: { open: "1".repeat(20_000) } })).status, 400);
});
