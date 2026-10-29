import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { narrate } from "../src/core/narrate.ts";
import { fixture, startTestCore } from "./helpers.ts";

// The sentences come from the recording and the graph alone, so a graph from any language works: this one is not Python.
const step = (id: string, kind: string, label: string, line: number, construct = kind) => ({ id, kind, label, line, construct });
const graph = {
  steps: [step("s", "start", "total(items)", 1), step("a", "step", "sum = 0", 2, "assign"), step("l", "loop", "for x in items", 3, "for"), step("b", "branch", "if x > 1", 4, "if"),
    step("c", "step", "print(sum)", 5, "call"), step("w", "step", "with lock", 6, "with"), step("r", "return", "return sum", 7), step("e", "end", "end", 8)],
  edges: [
    { from: "l", to: "b", label: "true", exit: "next item" }, { from: "l", to: "r", label: "false", exit: "done" },
    { from: "b", to: "c", label: "true", exit: "Yes" }, { from: "b", to: "w", label: "false", exit: "No" },
  ],
};
const visit = (stepId: string, locals: Record<string, string> = {}) => ({ step: stepId, locals });

test("assignments, calls, branches, loops and returns are each told in one sentence", () => {
  const rec = {
    visits: [visit("s", { items: "[2]" }), visit("a", { items: "[2]" }), visit("l", { items: "[2]", sum: "0" }), visit("b", { items: "[2]", sum: "0", x: "2" }),
      visit("c", { items: "[2]", sum: "0", x: "2" }), visit("l", { items: "[2]", sum: "1", x: "2" }), visit("r", { items: "[2]", sum: "1", x: "2" }), visit("e", { items: "[2]", sum: "1", x: "2" })],
    result: "1",
  };
  assert.deepEqual(narrate(graph, rec), [
    "The function is called with items = [2].",
    "Line 1 ran: the function started with items = [2].",
    "Line 2 ran: sum was set to 0.",
    "Line 3 ran: the loop took its next item, and x was set to 2.",
    "Line 4 ran: the condition x > 1 was true, so it took the first way.",
    "Line 5 ran: sum went from 0 to 1.",
    "Line 3 ran: the loop had no items left, so it ended.",
    "Line 7 ran: the function returned 1.",
  ]);
});

test("a step the narrator does not know says only the line and what changed", () => {
  const rec = { visits: [visit("s"), visit("w", { n: "1" }), visit("r", { n: "2" })] };
  const [, , third] = narrate(graph, rec);
  assert.equal(third, "Line 6 ran: n went from 1 to 2.");
});

test("long values are shortened with an ellipsis and a branch that went the other way says so", () => {
  const long = "x".repeat(80);
  const rec = { visits: [visit("s"), visit("a", { sum: long }), visit("l", { sum: `'${long}'` }), visit("b"), visit("w")] };
  const told = narrate(graph, rec);
  assert.match(told[2], /^Line 2 ran: sum went from x{20,}… to '/);
  assert.ok(told[2].length < 120);
  assert.equal(told[4], "Line 4 ran: the condition x > 1 was false, so it took the other way.");
});

test("a run that failed or was cut short says so on its last step", () => {
  const failed = { visits: [visit("s", { a: "1" }), visit("r", { a: "1" })], error: { type: "ZeroDivisionError", message: "division by zero" } };
  assert.equal(narrate(graph, failed)[1], "Line 1 ran: the function started with a = 1. Line 7 then stopped the run with ZeroDivisionError: division by zero.");
  const cut = { visits: [visit("s"), visit("a")], truncated: true };
  assert.equal(narrate(graph, cut)[1], "Line 1 ran: the function started with no arguments. The recording stops here because the run took too many steps.");
  assert.deepEqual(narrate(graph, { visits: [] }), []);
});

let t: Awaited<ReturnType<typeof startTestCore>>;
const project = fixture("playback");
before(async () => {
  t = await startTestCore();
  await t.post("/projects", { path: project });
});
after(() => t.core.close());

test("a recording over the protocol carries one sentence per step", async () => {
  const rec = await (await t.post("/playback", { project, node: "ops.drain", args: [130] })).json();
  assert.equal(rec.narration.length, rec.visits.length);
  assert.equal(rec.narration[0], "The function is called with total = 130.");
  assert.equal(rec.narration[2], "Line 5 ran: steps was set to 0.");
  assert.equal(rec.narration[3], "Line 6 ran: the condition total > 100 was true, so the loop went round again.");
  assert.equal(rec.narration[4], "Line 7 ran: total went from 130 to 120.");
  assert.equal(rec.narration[12], "Line 6 ran: the condition total > 100 was false, so the loop ended.");
  assert.equal(rec.narration[13], "Line 9 ran: the function returned 3.");
});

test("a branch and an exception are told over the protocol", async () => {
  const fact = await (await t.post("/playback", { project, node: "ops.fact", args: [3] })).json();
  assert.match(fact.narration[2], /^Line \d+ ran: the condition n <= 1 was false, so it took the other way\.$/);
  const bad = await (await t.post("/playback", { project, node: "ops.divide", values: { a: "1", b: "0" } })).json();
  assert.match(bad.narration.at(-1), /then stopped the run with ZeroDivisionError: division by zero\.$/);
});
