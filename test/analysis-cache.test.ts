import { test, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "../src/core/adapters.ts"; // first: adapters.ts and python-adapter.ts import each other, and adapters.ts must be the one that starts
import { cachedAnalysis } from "../src/core/analysis-cache.ts";
import { pythonAdapter } from "../src/core/python-adapter.ts";
import { startCore } from "../src/core/server.ts";
import type { Analysis, LanguageAdapter } from "../src/core/adapters.ts";
import { fixture } from "./helpers.ts";

// big-projects 01: opening a Project again, or after a change to a few files, must not pay for the whole analysis again.
// The analysis of each Project is kept in the person's own folder, never inside the Project, keyed by what the analyzer reads.
const scratch: string[] = [];
const temp = (prefix: string) => { const d = mkdtempSync(join(tmpdir(), prefix)); scratch.push(d); return d; };
after(() => scratch.forEach((d) => rmSync(d, { recursive: true, force: true })));

const analysis = (name: string): Analysis => ({ nodes: [{ id: name, kind: "module", name, parent: null, file: `${name}.py`, line: 1, endLine: 1 }], errors: [], relationships: [], unresolved: 0 });
function fake(signatureOf: () => string) {
  const adapter = { calls: 0, async analyze() { adapter.calls++; return analysis(`run${adapter.calls}`); }, signature: signatureOf } as LanguageAdapter & { calls: number };
  return adapter;
}

test("the same signature is answered from the cache; a different one analyses again", async () => {
  const cache = temp("aidea-cache-");
  let sig = "a";
  const adapter = fake(() => sig);
  const first = await cachedAnalysis(cache, "/some/project", adapter);
  const second = await cachedAnalysis(cache, "/some/project", adapter);
  assert.equal(adapter.calls, 1);
  assert.deepEqual(second, first);
  sig = "b";
  const third = await cachedAnalysis(cache, "/some/project", adapter);
  assert.equal(adapter.calls, 2);
  assert.notDeepEqual(third, first);
  assert.equal(adapter.calls, 2);
  await cachedAnalysis(cache, "/some/project", adapter);
  assert.equal(adapter.calls, 2, "the new signature is kept");
});

test("two Projects do not share a cache entry", async () => {
  const cache = temp("aidea-cache-");
  const adapter = fake(() => "same");
  await cachedAnalysis(cache, "/one", adapter);
  await cachedAnalysis(cache, "/two", adapter);
  assert.equal(adapter.calls, 2);
});

test("with no cache folder, or an adapter without a signature, the analysis always runs", async () => {
  const adapter = fake(() => "a");
  await cachedAnalysis(undefined, "/p", adapter);
  await cachedAnalysis(undefined, "/p", adapter);
  assert.equal(adapter.calls, 2);
  const cache = temp("aidea-cache-");
  const bare = { calls: 0, async analyze() { bare.calls++; return analysis("x"); } } as LanguageAdapter & { calls: number };
  await cachedAnalysis(cache, "/p", bare);
  await cachedAnalysis(cache, "/p", bare);
  assert.equal(bare.calls, 2);
});

test("a damaged cache entry, or a cache folder that cannot be written, never breaks opening a Project", async () => {
  const cache = temp("aidea-cache-");
  const adapter = fake(() => "a");
  await cachedAnalysis(cache, "/p", adapter);
  const dir = join(cache, "analysis");
  for (const f of readdirSync(dir)) writeFileSync(join(dir, f), "{ not json");
  const again = await cachedAnalysis(cache, "/p", adapter);
  assert.equal(adapter.calls, 2);
  assert.equal(again.nodes.length, 1);
  const blocked = join(temp("aidea-cache-"), "a-file");
  writeFileSync(blocked, "I am a file, not a folder");
  const out = await cachedAnalysis(blocked, "/p", adapter);
  assert.equal(out.nodes.length, 1);
});

test("the Python adapter's signature changes with a file's content or time, a new file and a removed file, and ignores what the analyzer ignores", () => {
  const root = temp("aidea-sig-");
  mkdirSync(join(root, "pkg"), { recursive: true });
  writeFileSync(join(root, "a.py"), "def a():\n    return 1\n");
  writeFileSync(join(root, "pkg", "b.py"), "def b():\n    return 2\n");
  const sign = () => pythonAdapter.signature!(root);
  const base = sign();
  assert.equal(sign(), base, "stable while nothing changes");
  for (const [dir, file] of [["", "notes.txt"], ["__pycache__", "x.py"], [".git", "y.py"], ["node_modules", "z.py"], [".venv", "w.py"]]) {
    mkdirSync(join(root, dir), { recursive: true });
    writeFileSync(join(root, dir, file), "x = 1\n");
    assert.equal(sign(), base, `${dir}/${file} is not read by the analyzer`);
  }
  writeFileSync(join(root, "a.py"), "def a():\n    return 11\n");
  const edited = sign();
  assert.notEqual(edited, base, "a changed size");
  const later = new Date(Date.now() + 60_000);
  utimesSync(join(root, "a.py"), later, later);
  assert.notEqual(sign(), edited, "a changed time");
  writeFileSync(join(root, "c.py"), "def c():\n    return 3\n");
  const added = sign();
  assert.notEqual(added, edited, "a new file");
  rmSync(join(root, "pkg", "b.py"));
  assert.notEqual(sign(), added, "a removed file");
});

test("through the core: the second opening is answered from the cache, equal to the first, and nothing is written inside the Project", async () => {
  const cache = temp("aidea-cache-");
  const project = temp("aidea-proj-");
  cpSync(fixture("shop"), project, { recursive: true });
  const before = JSON.stringify(readdirSync(project, { recursive: true }));
  const core = await startCore({ port: 0, cacheDir: cache });
  try {
    const open = async () => { const t0 = performance.now(); const r = await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) }); return { body: await r.json() as any, status: r.status, ms: performance.now() - t0 }; };
    const first = await open();
    assert.equal(first.status, 201);
    assert.ok(existsSync(join(cache, "analysis")), "an entry was written in the cache folder");
    const second = await open();
    assert.equal(second.status, 201);
    assert.deepEqual(second.body.nodes, first.body.nodes);
    assert.deepEqual(second.body.relationships, first.body.relationships);
    assert.equal(JSON.stringify(readdirSync(project, { recursive: true })), before, "the Project folder was not touched");
    writeFileSync(join(project, "extra.py"), "def extra():\n    return 1\n");
    const third = await open();
    assert.ok(third.body.nodes.some((n: any) => n.id === "extra"), "a new file shows after the next opening");
  } finally { core.close(); }
});

test("opening a generated Project of 200 modules and 4,000 functions stays inside a budget", async () => {
  const root = temp("aidea-big-");
  const calls = (m: number, f: number) => Array.from({ length: 4 }, (_, k) => `    helper_${(f + k + 1) % 20}(x)`).join("\n") + `\n    return mod_${(m + 1) % 200}.helper_${f % 20}(x)`;
  for (let m = 0; m < 200; m++) {
    const body = [`import os`, `import mod_${(m + 1) % 200}`, ""];
    for (let f = 0; f < 20; f++) body.push(`def helper_${f}(x):`, `    if x > ${f}:`, `        os.path.join("a", "b")`, calls(m, f), "");
    writeFileSync(join(root, `mod_${m}.py`), body.join("\n"));
  }
  const t0 = performance.now();
  const out = await pythonAdapter.analyze(root);
  const ms = performance.now() - t0;
  assert.equal(out.nodes.filter((n) => n.kind === "function").length, 4000);
  assert.ok(ms < 2700, `analysing took ${Math.round(ms)} ms`);
});
