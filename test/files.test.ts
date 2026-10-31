import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startTestCore } from "./helpers.ts";

const t = await startTestCore();
after(() => t.core.close());

type Entry = { name: string; path: string; kind: "folder" | "file"; ignored?: true; truncated?: number; language?: string; analysed?: boolean; children?: Entry[] };

const put = (root: string, rel: string, text = "x") => { mkdirSync(join(root, rel, ".."), { recursive: true }); writeFileSync(join(root, rel), text); };
const open = async (dir: string) => ((await (await t.post("/projects", { path: dir })).json()) as { id: string }).id;
const files = async (id: string) => (await t.get(`/files?project=${encodeURIComponent(id)}`)).json() as Promise<{ project: string; root: Entry[] }>;
const find = (list: Entry[], path: string): Entry | undefined => { for (const e of list) { if (e.path === path) return e; const hit = e.children && find(e.children, path); if (hit) return hit; } };
// A snapshot of every file and folder with its size and modification time, to prove that browsing writes nothing.
const snapshot = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = join(dir, e.name), s = statSync(p);
  return e.isDirectory() ? [`${p}:dir`, ...snapshot(p)] : [`${p}:${s.size}:${s.mtimeMs}`];
});

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "aidea-files-"));
  for (const rel of ["app.py", "util.ts", "notes.md", "data.bin", "Zeta.txt", "pkg/core.py", "pkg/sub/deep.py", ".github/workflows/ci.yml"]) put(dir, rel);
  mkdirSync(join(dir, "empty"));
  for (const rel of [".git/config", "node_modules/m/m.js", "dist/out.js", "__pycache__/x.pyc", ".venv/lib/y.py", "pkg/__pycache__/z.pyc"]) put(dir, rel);
  return dir;
}

test("the files route returns the nested folders and files of a Project, folders first, each group in alphabetical order", async () => {
  const dir = fixture();
  const { root } = await files(await open(dir));
  assert.deepEqual(root.map((e) => `${e.kind}:${e.name}`), [
    "folder:.git", "folder:.github", "folder:.venv", "folder:__pycache__", "folder:dist", "folder:empty", "folder:node_modules", "folder:pkg",
    "file:app.py", "file:data.bin", "file:notes.md", "file:util.ts", "file:Zeta.txt",
  ]);
  assert.deepEqual(find(root, "pkg")!.children!.map((e) => e.path), ["pkg/__pycache__", "pkg/sub", "pkg/core.py"], "paths are relative to the Project and use /");
  assert.equal(find(root, "pkg/sub/deep.py")!.name, "deep.py");
  assert.deepEqual(find(root, "empty")!.children, []);
  assert.ok(find(root, ".github/workflows/ci.yml"), "a hidden folder that holds work is not skipped");
});

test("version-control data, dependencies, caches and build output are listed but never opened", async () => {
  const dir = fixture();
  const { root } = await files(await open(dir));
  for (const p of [".git", ".venv", "__pycache__", "dist", "node_modules", "pkg/__pycache__"]) {
    const e = find(root, p)!;
    assert.equal(e.ignored, true, `${p} is marked ignored`);
    assert.equal(e.children, undefined, `${p} is not walked`);
  }
  assert.equal(find(root, "pkg")!.ignored, undefined);
});

test("a file in a language aidea can read is marked with it; any other file is a plain file", async () => {
  const { root } = await files(await open(fixture()));
  assert.deepEqual([find(root, "app.py")!.language, find(root, "app.py")!.analysed], ["Python", true]);
  assert.deepEqual([find(root, "util.ts")!.language, find(root, "util.ts")!.analysed], ["TypeScript", true]);
  for (const p of ["notes.md", "data.bin", "Zeta.txt"]) assert.deepEqual([find(root, p)!.language, find(root, p)!.analysed], [undefined, false], p);
});

test("browsing writes nothing to the Project", async () => {
  const dir = fixture();
  const before = snapshot(dir);
  await files(await open(dir));
  assert.deepEqual(snapshot(dir), before);
});

test("it works on a folder where no language is understood", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-files-plain-"));
  put(dir, "Assets/Scenes/Main.unity"); put(dir, "ProjectSettings/ProjectVersion.txt");
  const { root } = await files(await open(dir));
  assert.deepEqual(root.map((e) => e.name), ["Assets", "ProjectSettings"]);
  assert.equal(find(root, "Assets/Scenes/Main.unity")!.analysed, false);
});

test("a folder with thousands of entries is cut at a limit and says how many it left out", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-files-big-"));
  mkdirSync(join(dir, "big"));
  for (let i = 0; i < 3200; i++) writeFileSync(join(dir, "big", `f${String(i).padStart(4, "0")}.txt`), "");
  put(dir, "a.txt");
  const { root } = await files(await open(dir));
  const big = find(root, "big")!;
  assert.ok(big.children!.length >= 1000 && big.children!.length < 3200, `listed ${big.children!.length}`);
  assert.equal(big.children!.length + big.truncated!, 3200);
  assert.ok(find(root, "a.txt"), "the entries after the big folder are still listed");
});

test("the files route refuses a request without a Project and a Project that is not open", async () => {
  assert.equal((await t.get("/files")).status, 400);
  assert.equal((await t.get("/files?project=nope")).status, 404);
});
