import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

// Ticket 07 replaced the parent-connector layout of the Architecture layer with boundaries (the full layout is covered
// in architecture-layout.test.ts): a child is inside its parent's box, and the guarantees below still hold.
test("a child sits inside its parent's box; the parent's rect is the boundary", async () => {
  const at = await rectsOf([node("p"), node("c", "p")]);
  const [p, c] = [at.get("p")!, at.get("c")!];
  assert.ok(c.x > p.x && c.y > p.y && c.x + c.width < p.x + p.width && c.y + c.height < p.y + p.height);
});

test("siblings sit inside the same box without touching", async () => {
  const at = await rectsOf([node("p"), node("a", "p"), node("b", "p")]);
  const [p, a, b] = ["p", "a", "b"].map((id) => at.get(id)!);
  assert.ok(!overlap(a, b));
  for (const c of [a, b]) assert.ok(c.x >= p.x && c.x + c.width <= p.x + p.width && c.y >= p.y && c.y + c.height <= p.y + p.height);
});

test("roots beside a boundary do not collide with its children", async () => {
  const at = await rectsOf([node("r1"), node("c1", "r1"), node("c2", "r1"), node("r2"), node("r3"), node("r4"), node("r5")]);
  const all = [...at.values()].filter((r) => r.id !== "r1"); // r1 is the boundary around c1 and c2
  for (const a of all) for (const b of all) if (a !== b) assert.ok(!overlap(a, b), `${a.id} overlaps ${b.id}`);
  for (const id of ["r2", "r3", "r4", "r5"]) assert.ok(!overlap(at.get(id)!, at.get("r1")!), `${id} is outside the boundary`);
});

test("a cycle of parents does not hang: its Nodes become roots", async () => {
  const at = await rectsOf([node("a", "b"), node("b", "a"), node("c")]);
  assert.deepEqual([...at.keys()], ["a", "b", "c"]);
  const all = [...at.values()];
  for (const a of all) for (const b of all) if (a !== b) assert.ok(!overlap(a, b));
});
