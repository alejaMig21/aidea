import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startCore } from "../src/core/server.ts";

const core = await startCore({ port: 0, adapter: { options: { modes: [], models: [] }, run: async function* () {} } });
after(() => core.close());

type Opened = { nodes: { kind: string; file: string }[]; languages: { language: string; label: string; files: number; analysed: boolean }[] };

async function open(files: string[]): Promise<Opened> {
  const dir = mkdtempSync(join(tmpdir(), "aidea-lang-"));
  for (const f of files) {
    mkdirSync(join(dir, f, ".."), { recursive: true });
    writeFileSync(join(dir, f), f.endsWith(".py") ? "def f():\n    return 1\n" : "x\n");
  }
  const res = await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: dir }) });
  assert.equal(res.status, 201);
  return (await res.json()) as Opened;
}

test("opening a project returns its languages with file counts and which have an adapter", async () => {
  const p = await open(["a.py", "pkg/b.py", "web/app.ts", "web/view.tsx", "web/main.js", "README.md"]);
  assert.deepEqual(p.languages, [
    { language: "python", label: "Python", files: 2, analysed: true },
    { language: "typescript", label: "TypeScript", files: 2, analysed: false },
    { language: "javascript", label: "JavaScript", files: 1, analysed: false },
  ]);
});

test("dependency and build folders are not counted", async () => {
  const p = await open(["a.py", "node_modules/m/x.js", "dist/y.js", "build/z.ts", "venv/lib/w.py", ".hidden/v.js", "pkg/site-packages/u.py"]);
  assert.deepEqual(p.languages.map((l) => [l.language, l.files]), [["python", 1]]);
});

test("a mixed project still analyses its Python part", async () => {
  const p = await open(["a.py", "b.js", "c.js"]);
  assert.deepEqual(p.nodes.filter((n) => n.kind === "module").map((n) => n.file), ["a.py"]);
  assert.deepEqual(p.languages.map((l) => [l.language, l.files, l.analysed]), [["javascript", 2, false], ["python", 1, true]]);
});

test("a project with no analysable language opens with no nodes", async () => {
  const p = await open(["app.js", "lib/util.js"]);
  assert.deepEqual(p.nodes, []);
  assert.deepEqual(p.languages, [{ language: "javascript", label: "JavaScript", files: 2, analysed: false }]);
});

test("an empty folder has no languages", async () => {
  assert.deepEqual((await open([])).languages, []);
});
