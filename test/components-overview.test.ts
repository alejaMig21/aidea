import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CoreNode } from "../src/core/types.ts";
import { layoutComponentsDiagram } from "../src/core/components-layout.ts";
import { startTestCore } from "./helpers.ts";

// A project with more than 40 modules opens the Components layer as an overview (one box per module, grouped by folder);
// 40 or fewer keep the detailed layout; `module=<id>` returns the detail of one module.
let t: Awaited<ReturnType<typeof startTestCore>>;
const scratch: string[] = [];
before(async () => { t = await startTestCore(); });
after(() => { t.core.close(); for (const dir of scratch) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); });

// `modules` small modules spread over `folders` folders; each defines a class, a method and two functions, and calls `fanout` others in other modules.
function generate(modules: number, folders: number, fanout: number): string {
  const root = mkdtempSync(join(tmpdir(), "aidea-overview-"));
  scratch.push(root);
  const folderOf = (i: number) => `pkg${i % folders}`;
  for (let f = 0; f < folders; f++) mkdirSync(join(root, `pkg${f}`));
  for (let i = 0; i < modules; i++) {
    const lines: string[] = [];
    const targets = Array.from({ length: fanout }, (_, k) => (i + 1 + k) % modules).filter((j) => j !== i);
    for (const j of targets) lines.push(`from ${folderOf(j)}.m${j} import f${j}`);
    lines.push("", "", `class C${i}:`, "    def run(self):", `        return f${i}()`, "", "", `def f${i}():`);
    lines.push(...(targets.length ? targets.map((j) => `    f${j}()`) : ["    pass"]), "    return 1", "", "", `def g${i}():`, "    return 2", "");
    writeFileSync(join(root, folderOf(i), `m${i}.py`), lines.join("\n"));
  }
  return root;
}

type Rect = { id: string; x: number; y: number; width: number; height: number };
type Route = { kind: string; resolution: string; from: string; to: string | null; count: number; ends: string[] };
type Body = { mode: string; rects: Rect[]; routes: Route[]; counts?: Record<string, { classes: number; functions: number }>; pairs?: { total: number; shown: number } };
async function open(root: string, module?: string): Promise<{ nodes: CoreNode[]; status: number; body: Body }> {
  const project = await (await t.post("/projects", { path: root })).json();
  const res = await t.get(`/layout?project=${encodeURIComponent(root)}&layer=components${module ? `&module=${encodeURIComponent(module)}` : ""}`);
  return { nodes: project.nodes, status: res.status, body: await res.json() };
}
const right = (rects: Rect[]) => Math.max(...rects.map((r) => r.x + r.width));
const bottom = (rects: Rect[]) => Math.max(...rects.map((r) => r.y + r.height));
const apart = (a: Rect, b: Rect) => a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y;

test("120 modules in 6 folders open as an overview: a box per module, a label per folder, no per-class boxes", async () => {
  const { nodes, body } = await open(generate(120, 6, 3));
  assert.equal(body.mode, "overview");
  const modules = nodes.filter((n) => n.kind === "module");
  assert.equal(modules.length, 120);
  const ids = body.rects.map((r) => r.id);
  assert.equal(body.rects.length, 120 + 6, "one rectangle per module plus one per folder");
  assert.equal(ids.filter((id) => id.startsWith("folder:")).length, 6);
  for (const m of modules) assert.ok(ids.includes(m.id), `${m.id} has a box`);
  assert.ok(!nodes.some((n) => n.kind !== "module" && ids.includes(n.id)), "classes and functions get no box");
  assert.deepEqual(body.counts?.[modules[0].id], { classes: 1, functions: 3 }); // run, f, g
});

test("the overview fits about one screen: wrapped rows, not one strip, and no two module boxes overlap", async () => {
  const { nodes, body } = await open(generate(120, 6, 3));
  assert.ok(right(body.rects) <= 2200, `width ${right(body.rects)}`);
  assert.ok(bottom(body.rects) > 600, "several rows");
  const boxes = body.rects.filter((r) => nodes.some((n) => n.id === r.id));
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.ok(apart(boxes[i], boxes[j]), `${boxes[i].id} / ${boxes[j].id}`);
  const folder = (r: Rect) => body.rects.find((f) => f.id === `folder:${nodes.find((n) => n.id === r.id)!.file.split("/").slice(0, -1).join("/")}`)!;
  for (const b of boxes) {
    const f = folder(b);
    assert.ok(b.x >= f.x && b.y > f.y && b.x + b.width <= f.x + f.width && b.y + b.height <= f.y + f.height, `${b.id} sits in its folder`);
  }
});

test("the overview is deterministic", async () => {
  const root = generate(120, 6, 3);
  const a = await open(root), b = await open(root);
  assert.deepEqual(a.body, b.body);
});

test("routes are merged to one per ordered pair of modules, between modules", async () => {
  const { nodes, body } = await open(generate(120, 6, 3));
  const modules = new Set(nodes.filter((n) => n.kind === "module").map((n) => n.id));
  assert.ok(body.routes.length >= 120);
  const pairs = body.routes.map((r) => `${r.from}>${r.to}`);
  assert.equal(new Set(pairs).size, pairs.length, "one route per ordered pair");
  for (const r of body.routes) {
    assert.ok(modules.has(r.from) && r.to && modules.has(r.to), "module to module");
    assert.ok(r.count >= 1 && ["resolved", "inferred", "unresolved"].includes(r.resolution));
    assert.deepEqual(r.ends, [r.from, r.to]);
  }
  assert.equal(body.pairs?.shown, body.routes.length);
});

test("at most 400 pairs are drawn, the strongest first, and the response says how many exist", async () => {
  const { body } = await open(generate(45, 3, 44));
  assert.equal(body.mode, "overview");
  assert.equal(body.routes.length, 400);
  assert.equal(body.pairs?.total, 45 * 44);
  for (let i = 1; i < body.routes.length; i++) assert.ok(body.routes[i - 1].count >= body.routes[i].count, "ordered by count");
});

test("the detail of one module returns its own boxes only, and what leaves it as stubs", async () => {
  const root = generate(120, 6, 3);
  const { nodes } = await open(root);
  const mod = nodes.find((n) => n.kind === "module")!;
  const { status, body } = await open(root, mod.id);
  assert.equal(status, 200);
  assert.equal(body.mode, "detail");
  const mine = new Set(nodes.filter((n) => n.id === mod.id || n.id.startsWith(`${mod.id}.`)).map((n) => n.id));
  assert.ok(body.rects.length > 1);
  for (const r of body.rects) assert.ok(mine.has(r.id.split("#")[0]), `${r.id} belongs to the module`);
  assert.ok(body.routes.length > 0);
  for (const r of body.routes) assert.ok(mine.has(r.from), "every route leaves the module or stays inside it");
  assert.ok(body.routes.some((r) => r.to === null), "calls to other modules are stubs");
});

test("asking for the detail of something that is not a module is a 404", async () => {
  const root = generate(50, 5, 2);
  const { status } = await open(root, "pkg0.nothing");
  assert.equal(status, 404);
});

test("40 modules or fewer keep exactly the detailed layout", async () => {
  const root = generate(30, 3, 3);
  const { nodes, body } = await open(root);
  assert.equal(body.mode, "detail");
  assert.deepEqual(body.rects, layoutComponentsDiagram(nodes).rects); // rectangles never depend on relationships
});

test("the counts on a module box say 'classes', not 'classs'", () => {
  const source = readFileSync(new URL("../src/ui/features/47-components.js", import.meta.url), "utf8");
  const plural = new Function(`${/const componentsPlural = .*/.exec(source)![0]}; return componentsPlural;`)() as (n: number, word: string) => string;
  assert.deepEqual([plural(0, "class"), plural(1, "class"), plural(3, "function"), plural(1, "function")], ["0 classes", "1 class", "3 functions", "1 function"]);
});
