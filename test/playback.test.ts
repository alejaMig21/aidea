import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const project = fixture("playback");
before(async () => {
  t = await startTestCore();
  await t.post("/projects", { path: project });
});
after(() => {
  t.core.close();
  rmSync(join(project, "blocked.txt"), { force: true }); // only exists if the safety net failed
  rmSync(join(project, "x.txt"), { force: true });
});

type Entry = { step: string; locals: Record<string, string> };
const record = (node: string, body: Record<string, unknown> = {}) => t.post("/playback", { project, node, ...body });
const labelsOf = async (node: string) => {
  const g = await (await t.get(`/algorithm?project=${encodeURIComponent(project)}&node=${encodeURIComponent(node)}`)).json();
  const label = new Map<string, string>(g.steps.map((s: { id: string; label: string }) => [s.id, s.label]));
  return (entry: Entry) => label.get(entry.step);
};

test("choosing a pure function and inputs records the steps it went through and the values on arrival", async () => {
  const res = await record("ops.drain", { args: [130] });
  assert.equal(res.status, 201);
  const rec = await res.json();
  const label = await labelsOf("ops.drain");
  assert.deepEqual(rec.trace.map(label), [
    "drain(total)",
    "steps = 0",
    "while total > 100",
    "total -= 10",
    "steps += 1",
    "while total > 100",
    "total -= 10",
    "steps += 1",
    "while total > 100",
    "total -= 10",
    "steps += 1",
    "while total > 100",
    "return steps",
    "end",
  ]);
  assert.equal(rec.result, "3");
  assert.deepEqual(rec.trace[0].locals, { total: "130" }); // the arguments
  assert.deepEqual(rec.trace[1].locals, { total: "130" }); // `steps` does not exist yet
  assert.deepEqual(rec.trace[11].locals, { total: "100", steps: "3" }); // the fourth time the loop condition is checked
  assert.equal(rec.error, undefined);
  assert.equal(rec.truncated, false);
});

test("a method is played on an instance built from the given constructor arguments", async () => {
  const rec = await (await record("ops.Counter.bump", { instance: { args: [5] }, args: [2] })).json();
  assert.equal(rec.result, "7");
  assert.equal(rec.trace[0].locals.by, "2");
});

test("a function that prints has its output kept in the recording", async () => {
  const rec = await (await record("ops.greet", { args: ["Ada"] })).json();
  assert.equal(rec.output, "hello Ada\n");
  assert.equal(rec.result, "3");
});

test("a function with external effects is refused, naming the call and its line", async () => {
  const res = await record("ops.save", { args: ["x"] });
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.match(body.error, /open/);
  assert.deepEqual(body.effects, [{ name: "open", line: 26 }]);
  assert.equal(existsSync(join(project, "x.txt")), false);
});

test("an external effect that is replaced by fake data lets the function play", async () => {
  const rec = await (await record("ops.load", { args: ["anything.txt"], fakes: { open: "file text" } })).json();
  assert.equal(rec.result, "'file text'");
});

test("an effect hidden inside a helper is stopped while running, and nothing is written", async () => {
  const res = await record("ops.indirect");
  assert.equal(res.status, 201);
  const rec = await res.json();
  assert.equal(rec.error.type, "PermissionError");
  assert.match(rec.error.message, /blocked/);
  assert.equal(existsSync(join(project, "blocked.txt")), false);
});

test("replaying a recording gives the same result every time without running the code again", async () => {
  const first = await (await record("ops.jitter", { args: [1] })).json();
  const again = await (await t.get(`/playback?id=${encodeURIComponent(first.id)}`)).json();
  const andAgain = await (await t.get(`/playback?id=${encodeURIComponent(first.id)}`)).json();
  assert.deepEqual(again, first);
  assert.deepEqual(andAgain, first);
  // A new recording is a new run: the random number differs, so the replays above were not re-runs.
  const second = await (await record("ops.jitter", { args: [1] })).json();
  assert.notEqual(second.result, first.result);
});

test("a function that raises is recorded up to the failure", async () => {
  const res = await record("ops.divide", { args: [1, 0] });
  assert.equal(res.status, 201);
  const rec = await res.json();
  assert.equal(rec.error.type, "ZeroDivisionError");
  const label = await labelsOf("ops.divide");
  assert.deepEqual(rec.trace.map(label), ["divide(a, b)", "return a / b"]);
});

test("a function that never ends is stopped and the recording says it is cut short", async () => {
  const rec = await (await record("ops.forever")).json();
  assert.equal(rec.truncated, true);
  assert.ok(rec.trace.length > 100 && rec.trace.length <= 5000);
});

test("asking to play with bad input gives clear errors", async () => {
  assert.equal((await record("ops.drain", { args: "130" })).status, 400);
  assert.equal((await record("ops.drain", { fakes: { "not a name!": 1 } })).status, 400);
  assert.equal((await record("ops.nope")).status, 404);
  assert.equal((await t.post("/playback", { project: project + "-never-opened", node: "ops.drain" })).status, 404);
  const notAFunction = await record("ops.Counter");
  assert.equal(notAFunction.status, 422);
  assert.match((await notAFunction.json()).error, /function/);
  assert.equal((await t.get("/playback?id=pb-none")).status, 404);
});
