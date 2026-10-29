import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { adapterFor } from "../src/core/adapters.ts";
import type { Flow } from "../src/core/adapters.ts";
import { startTestCore } from "./helpers.ts";

// The flow graph of a TypeScript or JavaScript function, asked through the adapter (the protocol seam) and through the core's /algorithm route.
// The expected steps and edges are written by hand from the code of each fixture, in the shape the Python flow has (see algorithm.test.ts).

const roots: string[] = [];
function project(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "aidea-tsflow-"));
  roots.push(dir);
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), text);
  }
  return dir;
}
after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const flowOf = (dir: string, file: string, name: string): Promise<Flow> => adapterFor(dir).flow!(join(dir, file), name);
const steps = (g: Flow) => g.steps.map((s) => `${s.kind} | ${s.label}`);
// Edges described by the labels of their ends, so the expectations read like the picture.
const edges = (g: Flow) => {
  const label = new Map(g.steps.map((s) => [s.id, s.label]));
  return g.edges.map((e) => `${label.get(e.from)} -> ${label.get(e.to)}${e.label ? ` [${e.label}]` : ""}${e.back ? " (back)" : ""}`).sort();
};
const step = (g: Flow, label: string) => g.steps.find((s) => s.label === label)!;

const sources = {
  "src/shapes.ts": [
    "export function classify(items: number[], limit: number) {",
    "  let total = 0;",
    "  for (const item of items) {",
    "    if (item > limit) {",
    "      total += item;",
    "    } else {",
    "      continue;",
    "    }",
    "  }",
    "  return total;",
    "}",
    "export class Scorer {",
    "  score(x: number) { return x > 0 ? 1 : 0 }",
    "}",
    "export const double = (n: number) => n * 2;",
  ].join("\n"),
  "src/queue.ts": [
    "export function drain(queue: number[], mode: string) {",
    "  while (queue.length > 0) {",
    "    const next = queue.pop();",
    "    if (next === 0) break;",
    "  }",
    "  do {",
    '    mode = mode + "x";',
    "  } while (mode.length < 3);",
    "  switch (mode) {",
    '    case "a":',
    '    case "b":',
    "      queue.push(1);",
    "      break;",
    "    default:",
    "      queue.push(2);",
    "  }",
    "  return queue;",
    "}",
  ].join("\n"),
  "src/load.js": [
    "export async function load(paths, read) {",
    "  try {",
    "    const text = await read(paths[0]);",
    '    if (!text) throw new Error("empty");',
    "    paths.push(text?.trim());",
    "  } catch (err) {",
    "    console.log(err);",
    "  } finally {",
    "    paths.length = 0;",
    "  }",
    "  return paths.map((p) => p.length);",
    "}",
  ].join("\n"),
  "src/odd.ts": [
    "export function* ids(n: number) {",
    "  const twice = (x: number) => x * 2;",
    "  async function later() { return 1 }",
    "  yield twice(n);",
    "}",
  ].join("\n"),
};

test("if, else, for-of and continue give steps, labelled exits and a way back", async () => {
  const g = await flowOf(project(sources), "src/shapes.ts", "classify");
  assert.deepEqual(steps(g), [
    "start | classify(items: number[], limit: number)",
    "step | let total = 0",
    "loop | for item of items",
    "branch | if item > limit",
    "step | total += item",
    "step | continue",
    "return | return total",
    "end | end",
  ]);
  assert.deepEqual(edges(g), [
    "classify(items: number[], limit: number) -> let total = 0",
    "let total = 0 -> for item of items",
    "for item of items -> if item > limit [true]",
    "if item > limit -> total += item [true]",
    "if item > limit -> continue [false]",
    "total += item -> for item of items (back)",
    "continue -> for item of items (back)",
    "for item of items -> return total [false]",
    "return total -> end",
  ].sort());
  const test = step(g, "if item > limit");
  assert.deepEqual({ construct: test.construct, exits: test.exits, line: test.line, endLine: test.endLine }, { construct: "if", exits: ["Yes", "No"], line: 4, endLine: 4 });
  assert.deepEqual(g.edges.filter((e) => e.label === "true" && e.from === test.id).map((e) => e.exit), ["Yes"]);
  assert.equal(step(g, "for item of items").construct, "for");
  assert.deepEqual(step(g, "for item of items").exits, ["next item", "done"]);
  const add = step(g, "total += item");
  assert.deepEqual({ reads: add.reads, writes: add.writes, text: add.text, line: add.line }, { reads: ["item", "total"], writes: ["total"], text: "total += item;", line: 5 });
});

test("while, do-while, break, switch with fallthrough and default", async () => {
  const g = await flowOf(project(sources), "src/queue.ts", "drain");
  assert.deepEqual(steps(g), [
    "start | drain(queue: number[], mode: string)",
    "loop | while queue.length > 0",
    "step | const next = queue.pop()",
    "branch | if next === 0",
    "step | break",
    'step | mode = mode + "x"',
    "loop | while mode.length < 3",
    "branch | switch mode",
    'branch | case "a"',
    'branch | case "b"',
    "step | queue.push(1)",
    "step | break",
    "step | default",
    "step | queue.push(2)",
    "return | return queue",
    "end | end",
  ]);
  assert.deepEqual(edges(g), [
    "drain(queue: number[], mode: string) -> while queue.length > 0",
    "while queue.length > 0 -> const next = queue.pop() [true]",
    "const next = queue.pop() -> if next === 0",
    "if next === 0 -> break [true]",
    "if next === 0 -> while queue.length > 0 [false] (back)",
    'while queue.length > 0 -> mode = mode + "x" [false]',
    'break -> mode = mode + "x"',
    'mode = mode + "x" -> while mode.length < 3',
    'while mode.length < 3 -> mode = mode + "x" [true] (back)',
    "while mode.length < 3 -> switch mode [false]",
    'switch mode -> case "a"',
    'case "a" -> queue.push(1) [true]',
    'case "a" -> case "b" [false]',
    'case "b" -> queue.push(1) [true]',
    'case "b" -> default [false]',
    "queue.push(1) -> break",
    "break -> return queue",
    "default -> queue.push(2)",
    "queue.push(2) -> return queue",
    "return queue -> end",
  ].sort());
  assert.deepEqual(step(g, "while queue.length > 0").exits, ["yes", "no"]);
  assert.deepEqual(step(g, "switch mode").exits, ['"a"', '"b"']);
  assert.equal(step(g, "switch mode").construct, "match");
  assert.deepEqual(g.edges.map((e) => e.exit).filter((x) => x === '"a"' || x === "no match").sort(), ['"a"', "no match", "no match"]);
});

test("try, catch, finally, throw, await, optional chaining and a callback in plain JavaScript", async () => {
  const g = await flowOf(project(sources), "src/load.js", "load");
  assert.deepEqual(steps(g), [
    "start | load(paths, read)",
    "step | try",
    "step | const text = await read(paths[0])",
    "branch | if !text",
    'raise | throw new Error("empty")',
    "step | paths.push(text?.trim())",
    "step | catch (err)",
    "step | console.log(err)",
    "step | paths.length = 0",
    "return | return paths.map((p) => p.length)",
    "end | end",
  ]);
  assert.deepEqual(edges(g), [
    "load(paths, read) -> try",
    "try -> const text = await read(paths[0])",
    "try -> catch (err) [error]",
    "const text = await read(paths[0]) -> if !text",
    'if !text -> throw new Error("empty") [true]',
    "if !text -> paths.push(text?.trim()) [false]",
    "paths.push(text?.trim()) -> paths.length = 0",
    "catch (err) -> console.log(err)",
    "console.log(err) -> paths.length = 0",
    "paths.length = 0 -> return paths.map((p) => p.length)",
    'throw new Error("empty") -> end',
    "return paths.map((p) => p.length) -> end",
  ].sort());
  const caught = g.edges.find((e) => e.label === "error")!;
  assert.deepEqual({ exit: caught.exit, exception: caught.exception }, { exit: "any error", exception: "any error" });
  assert.equal(step(g, "catch (err)").construct, "except");
  assert.equal(step(g, "console.log(err)").io, "output");
  assert.equal(step(g, "paths.length = 0").finally, true);
  assert.equal(step(g, "paths.push(text?.trim())").finally, undefined);
  assert.deepEqual({ generic: step(g, "const text = await read(paths[0])").generic, construct: step(g, "const text = await read(paths[0])").construct }, { generic: true, construct: "await" });
});

test("a construct without a symbol is a generic step that names it, and a generator or an async function is read like any other", async () => {
  const dir = project(sources);
  const g = await flowOf(dir, "src/odd.ts", "ids");
  assert.deepEqual(steps(g), ["start | ids(n: number)", "step | const twice = (x: number) => x * 2", "step | async function later", "step | yield twice(n)", "end | end"]);
  assert.deepEqual(["lambda", "def", "yield"].map((c) => g.steps.find((s) => s.construct === c)?.generic), [true, true, true]);
  assert.deepEqual(g.steps.find((s) => s.construct === "def")!.writes, ["later"]);
  assert.equal((await flowOf(dir, "src/load.js", "load")).steps[0].label, "load(paths, read)");
});

test("a classic for loop is a loop with yes and no exits, and a labelled break is one plain step that says so", async () => {
  const dir = project({
    "a.js": [
      "function scan(n) {",
      "  let t = 0;",
      "  outer: for (let i = 0; i < n; i++) {",
      "    if (i > 5) break outer;",
      "    t += i;",
      "  }",
      "  return t;",
      "}",
    ].join("\n"),
  });
  const g = await flowOf(dir, "a.js", "scan");
  assert.deepEqual(edges(g), [
    "scan(n) -> let t = 0",
    "let t = 0 -> for (let i = 0; i < n; i++)",
    "for (let i = 0; i < n; i++) -> if i > 5 [true]",
    "if i > 5 -> break outer [true]",
    "if i > 5 -> t += i [false]",
    "t += i -> for (let i = 0; i < n; i++) (back)",
    "for (let i = 0; i < n; i++) -> return t [false]",
    "break outer -> t += i",
    "return t -> end",
  ].sort());
  assert.deepEqual(step(g, "for (let i = 0; i < n; i++)").exits, ["yes", "no"]);
  assert.deepEqual({ construct: step(g, "break outer").construct, generic: step(g, "break outer").generic }, { construct: "break", generic: true });
});

test("methods and arrow functions are found by their qualified name", async () => {
  const dir = project(sources);
  const method = await flowOf(dir, "src/shapes.ts", "Scorer.score");
  assert.deepEqual(steps(method), ["start | score(x: number)", "return | return x > 0 ? 1 : 0", "end | end"]);
  const arrow = await flowOf(dir, "src/shapes.ts", "double");
  assert.deepEqual(steps(arrow), ["start | double(n: number)", "return | return n * 2", "end | end"]);
  assert.deepEqual(edges(arrow), ["double(n: number) -> return n * 2", "return n * 2 -> end"].sort());
});

test("a missing function and a file the parser rejects are failures the person can act on", async () => {
  const dir = project({ ...sources, "src/bad.ts": "export function broken( {" });
  await assert.rejects(flowOf(dir, "src/shapes.ts", "nothing"), { status: 422, message: /no longer in its file/ });
  await assert.rejects(flowOf(dir, "src/bad.ts", "broken"), { status: 422, message: /cannot be read/ });
});

let t: Awaited<ReturnType<typeof startTestCore>>;
before(async () => { t = await startTestCore(); });
after(() => t.core.close());

test("the /algorithm route lays out the graph of a TypeScript function like a Python one", async () => {
  const dir = project(sources);
  await t.post("/projects", { path: dir });
  const res = await t.get(`/algorithm?project=${encodeURIComponent(dir)}&node=${encodeURIComponent("src/shapes.classify")}`);
  assert.equal(res.status, 200);
  const g = await res.json();
  assert.equal(g.steps.length, 8);
  assert.equal(g.rects.length, 8);
  assert.ok(g.routes.some((r: { back?: boolean }) => r) && g.frame.width > 0);
  assert.ok(g.steps.every((s: { lines?: unknown }) => Array.isArray(s.lines)));
});
