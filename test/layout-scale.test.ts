import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { layered } from "../src/core/layered.ts";
import { layoutArchitecture } from "../src/core/architecture.ts";
import { startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const scratch: string[] = [];
before(async () => {
  t = await startTestCore();
});
after(() => {
  t.core.close();
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const node = (id: string) => ({ id, width: 100, height: 40 });

test("a chain of 20000 nodes lays out without overflowing the stack (the last node has the smallest id, so ranking starts at the deepest end)", () => {
  const n = 20_000;
  const nodes = Array.from({ length: n }, (_, i) => node(`n${i}`));
  const edges = Array.from({ length: n - 1 }, (_, i) => ({ from: `n${i + 1}`, to: `n${i}` }));
  const started = Date.now();
  const out = layered(nodes, edges);
  assert.equal(out.rects.length, n);
  assert.ok(out.rects[0].y > out.rects[n - 1].y);
  assert.ok(Date.now() - started < 20_000, "finishes in reasonable time");
});

test("a chain of nodes with a way back that closes the cycle still lays out", () => {
  const n = 3_000;
  const nodes = Array.from({ length: n }, (_, i) => node(`n${i}`));
  const edges = [...Array.from({ length: n - 1 }, (_, i) => ({ from: `n${i}`, to: `n${i + 1}` })), { from: `n${n - 1}`, to: "n0" }];
  const out = layered(nodes, edges);
  assert.equal(out.rects.length, n);
  assert.equal(out.routes.length, n);
});

test("a 500-node tree lays out in a few seconds, each node below its parent", () => {
  const n = 500;
  const nodes = Array.from({ length: n }, (_, i) => node(`n${i}`));
  const edges = Array.from({ length: n - 1 }, (_, i) => ({ from: `n${Math.floor(i / 2)}`, to: `n${i + 1}` }));
  const started = Date.now();
  const out = layered(nodes, edges);
  assert.ok(Date.now() - started < 5_000, `took ${Date.now() - started} ms`);
  const at = new Map(out.rects.map((r) => [r.id, r]));
  for (const e of edges) assert.ok(at.get(e.to)!.y > at.get(e.from)!.y);
});

test("a 500-node architecture (a tree of boundaries and boxes) lays out in a few seconds", () => {
  const nodes = Array.from({ length: 500 }, (_, i) => ({
    id: `a${i}`, title: `Node ${i}`, technology: "Python", kind: i % 25 === 0 ? "system" : "container",
    ...(i % 25 !== 0 ? { parent: `a${i - (i % 25)}` } : {}),
    relations: i % 25 !== 0 ? [{ to: `a${(i + 1) % 500}`, label: "uses" }] : [],
  }));
  const started = Date.now();
  const d = layoutArchitecture(nodes);
  assert.ok(Date.now() - started < 5_000, `took ${Date.now() - started} ms`);
  assert.equal(d.rects.length, 500);
});

test("duplicate ids in the architecture layout: the first Node wins", () => {
  const d = layoutArchitecture([
    { id: "a", title: "First", technology: "x", description: "first one" },
    { id: "a", title: "Second", technology: "y", description: "second one" },
    { id: "b", title: "B", technology: "x" },
  ]);
  assert.equal(d.texts["a"].title, "First");
  assert.equal(d.rects.filter((r) => r.id === "a").length, 1);
});

test("a long function through the algorithm route lays out", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-long-"));
  scratch.push(dir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "long.py"), `def long(x):\n${Array.from({ length: 800 }, (_, i) => `    x = x + ${i}`).join("\n")}\n    return x\n`);
  await t.post("/projects", { path: dir });
  const res = await t.get(`/flow?project=${encodeURIComponent(dir)}&node=long.long`);
  assert.equal(res.status, 200);
  const g = (await res.json()) as { rects: unknown[] };
  assert.equal(g.rects.length, 803); // start, 800 assignments, return, end
});
