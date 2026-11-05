import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { layoutComponentsOverview } from "../src/core/components-layout.ts";
import { startCore } from "../src/core/server.ts";
import type { CoreNode, Relationship } from "../src/core/types.ts";

// big-projects 03: the overview draws at most 400 of the lines between modules (a pair is two modules that talk to each other); the person can draw more, or draw every line of one module.
const modules = (n: number): CoreNode[] => Array.from({ length: n }, (_, i) => ({ id: `m${i}`, kind: "module", name: `m${i}`, parent: null, file: `pkg${i % 5}/m${i}.py`, line: 1, endLine: 2 }) as CoreNode);
// Module i imports the next 10 modules: 60 modules give 600 distinct pairs, with module 0 also imported by the last ones so it has more lines than the others.
const links = (n: number): Relationship[] => {
  const out: Relationship[] = [];
  for (let i = 0; i < n; i++) for (let k = 1; k <= 10; k++) out.push({ kind: "imports", from: `m${i}`, to: `m${(i + k) % n}`, name: `m${(i + k) % n}`, resolution: "resolved", line: 1 });
  return out;
};
const nodes = modules(60), rels = links(60);

test("by default the 400 strongest of the pairs are drawn, and the cap is reported", () => {
  const o = layoutComponentsOverview(nodes, rels);
  assert.deepEqual([o.pairs.total, o.pairs.shown, o.pairs.cap], [600, 400, 400]);
  assert.equal(o.routes.length, 400);
});

test("a bigger cap draws more lines in steps, and Infinity draws them all", () => {
  assert.equal(layoutComponentsOverview(nodes, rels, { maxPairs: 800 }).pairs.shown, 600, "never more than there are");
  assert.equal(layoutComponentsOverview(nodes, rels, { maxPairs: 500 }).pairs.shown, 500);
  const all = layoutComponentsOverview(nodes, rels, { maxPairs: Infinity });
  assert.deepEqual([all.pairs.shown, all.pairs.total], [600, 600]);
});

test("a focused module draws every one of its lines even beyond the cap, and the others stay at the cap plus those", () => {
  const plain = layoutComponentsOverview(nodes, rels);
  const hiddenOf = (id: string) => layoutComponentsOverview(nodes, rels, { maxPairs: Infinity }).routes.filter((r) => (r.from === id || r.to === id)).length - plain.routes.filter((r) => r.from === id || r.to === id).length;
  const candidate = nodes.map((n) => n.id).find((id) => hiddenOf(id) > 0)!;
  assert.ok(candidate, "some module has lines beyond the cap");
  const focused = layoutComponentsOverview(nodes, rels, { focus: candidate });
  const lines = (id: string, o: typeof plain) => o.routes.filter((r) => r.from === id || r.to === id).length;
  assert.equal(lines(candidate, focused), lines(candidate, layoutComponentsOverview(nodes, rels, { maxPairs: Infinity })));
  assert.ok(focused.routes.length > 400 && focused.routes.length <= 400 + hiddenOf(candidate));
  assert.equal(focused.pairs.shown, focused.routes.length);
  assert.equal(layoutComponentsOverview(nodes, rels, { focus: "nope" }).routes.length, 400, "an unknown module changes nothing");
});

const scratch = mkdtempSync(join(tmpdir(), "aidea-pairs-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }));

test("the layout route takes pairs (a number or all) and focus, and clamps what it does not understand", async () => {
  const project = join(scratch, "big");
  mkdirSync(project, { recursive: true });
  const n = 45;
  for (let i = 0; i < n; i++) writeFileSync(join(project, `m${i}.py`), Array.from({ length: 12 }, (_, k) => `import m${(i + k + 1) % n}`).join("\n") + "\n");
  const core = await startCore({ port: 0, builtinPluginsDir: false });
  try {
    const open = await (await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) })).json() as any;
    const get = async (q: string) => (await (await fetch(`${core.url}/layout?project=${encodeURIComponent(open.id)}&layer=components${q}`)).json()) as any;
    const base = await get("");
    assert.equal(base.mode, "overview");
    assert.deepEqual([base.pairs.total, base.pairs.shown, base.pairs.cap], [540, 400, 400]);
    assert.equal((await get("&pairs=500")).pairs.shown, 500);
    assert.equal((await get("&pairs=all")).pairs.shown, 540);
    assert.equal((await get("&pairs=junk")).pairs.shown, 400, "a value it does not understand is the default");
    assert.equal((await get("&pairs=99999999")).pairs.shown, 540, "a huge number is the whole set");
    assert.equal((await get("&pairs=1")).pairs.shown, 50, "a tiny number is the least it will draw");
    assert.ok((await get("&focus=m0")).routes.length >= 400);
  } finally { core.close(); }
});
