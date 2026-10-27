import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const scratch: string[] = [];
before(async () => {
  t = await startTestCore();
});
after(() => {
  t.core.close();
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

type R = { id: string; x: number; y: number; width: number; height: number };
const node = (id: string, parent?: string) => ({
  id, title: id, technology: "x", ...(parent ? { parent } : {}), rationale: { why: "because", rejected: [] },
});
async function rectsOf(nodes: ReturnType<typeof node>[]) {
  const dir = mkdtempSync(join(tmpdir(), "aidea-layout-"));
  scratch.push(dir);
  mkdirSync(join(dir, ".aidea"));
  writeFileSync(join(dir, ".aidea", "architecture.json"), JSON.stringify({ nodes }));
  await t.post("/projects", { path: dir });
  const { rects } = await (await t.get(`/layout?project=${encodeURIComponent(dir)}&layer=architecture`)).json();
  return new Map<string, R>(rects.map((r: R) => [r.id, r]));
}
const overlap = (a: R, b: R) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test("a child sits below its parent, overlapping it horizontally; the root keeps its place", async () => {
  await t.post("/projects", { path: fixture("studio") });
  const { rects } = await (await t.get(`/layout?project=${encodeURIComponent(fixture("studio"))}&layer=architecture`)).json();
  assert.deepEqual(rects, [
    { id: "web-app", x: 0, y: 0, width: 240, height: 64 },
    { id: "quote-db", x: 0, y: 164, width: 240, height: 64 },
  ]);
});

test("siblings sit side by side, centred under their parent", async () => {
  const at = await rectsOf([node("p"), node("a", "p"), node("b", "p")]);
  const [p, a, b] = ["p", "a", "b"].map((id) => at.get(id)!);
  assert.equal(a.y, 164);
  assert.equal(b.y, 164);
  assert.equal(b.x - a.x, 280); // side by side, same gap as the grid
  assert.equal(p.x + 120, (a.x + b.x + 240) / 2); // the parent's centre is the middle of the pair
});

test("a root in a later grid row does not collide with the children of an earlier root", async () => {
  const at = await rectsOf([node("r1"), node("c1", "r1"), node("c2", "r1"), node("r2"), node("r3"), node("r4"), node("r5")]);
  const first = ["r1", "r2", "r3", "r4"].map((id) => at.get(id)!);
  assert.equal(new Set(first.map((r) => r.y)).size, 1); // four to a row, as before
  assert.ok(at.get("r5")!.y >= at.get("c1")!.y + 64);
  const all = [...at.values()];
  for (const a of all) for (const b of all) if (a !== b) assert.ok(!overlap(a, b), `${a.id} overlaps ${b.id}`);
});

test("a cycle of parents does not hang: its Nodes become roots", async () => {
  const at = await rectsOf([node("a", "b"), node("b", "a"), node("c")]);
  assert.deepEqual([...at.keys()], ["a", "b", "c"]);
  assert.deepEqual([...at.values()].map((r) => r.y), [0, 0, 0]);
});
