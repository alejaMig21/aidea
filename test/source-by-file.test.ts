import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { fixture, startTestCore } from "./helpers.ts";

const t = await startTestCore();
after(() => t.core.close());

const open = async (dir: string) => ((await (await t.post("/projects", { path: dir })).json()) as { id: string }).id;
const byFile = (project: string, file: string, extra = "") => t.get(`/source?project=${encodeURIComponent(project)}&file=${encodeURIComponent(file)}${extra}`);
const copy = () => { const dir = mkdtempSync(join(tmpdir(), "aidea-srcfile-")); cpSync(fixture("shop"), dir, { recursive: true }); return dir; };

test("the Code panel can ask for a file by its path in the Project, and gets the whole text", async () => {
  const dir = fixture("shop");
  const id = await open(dir);
  const res = await byFile(id, "cart.py");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.file, "cart.py");
  assert.equal(body.text, readFileSync(join(dir, "cart.py"), "utf-8"));
  assert.equal(body.line, undefined, "no Node and no range: nothing to highlight");
});

test("a file inside a folder is found with / in its path, and a range says which lines to highlight", async () => {
  const dir = copy();
  try {
    mkdirSync(join(dir, "pkg"));
    writeFileSync(join(dir, "pkg", "util.py"), "a = 1\nb = 2\nc = 3\n");
    const id = await open(dir);
    const body = await (await byFile(id, "pkg/util.py", "&from=2&to=3")).json();
    assert.deepEqual([body.file, body.line, body.endLine, body.text], ["pkg/util.py", 2, 3, "a = 1\nb = 2\nc = 3\n"]);
    for (const bad of ["&from=0&to=2", "&from=3&to=2", "&from=1&to=99", "&from=x&to=2", "&from=2"]) assert.equal((await byFile(id, "pkg/util.py", bad)).status, 400, bad);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a file by path is never served from outside the Project folder", async () => {
  const id = await open(fixture("shop"));
  for (const file of ["../helpers.ts", "..\\helpers.ts", "../../package.json", "C:/Windows/win.ini", "/etc/passwd"]) {
    const res = await byFile(id, file);
    assert.ok([400, 403, 404].includes(res.status), `${file} -> ${res.status}`);
    assert.doesNotMatch(JSON.stringify(await res.json()), /"text"/, file);
  }
});

test("a file by path that is too big, not text, a folder or gone is refused with a plain sentence", async () => {
  const dir = copy();
  try {
    const id = await open(dir);
    writeFileSync(join(dir, "big.txt"), "x = 1\n".repeat(100_000));
    assert.equal((await byFile(id, "big.txt")).status, 413);
    writeFileSync(join(dir, "bin.dat"), Buffer.from([0x63, 0x00, 0xff, 0x00, 0x0a]));
    const binary = await byFile(id, "bin.dat");
    assert.equal(binary.status, 415);
    assert.match((await binary.json()).error, /not text/i);
    mkdirSync(join(dir, "folder"));
    const folder = await byFile(id, "folder");
    assert.equal(folder.status, 400);
    assert.match((await folder.json()).error, /folder/i);
    const gone = await byFile(id, "nope.py");
    assert.equal(gone.status, 404);
    assert.match((await gone.json()).error, /moved|deleted|read/i);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the source route needs a Node or a file, and a Project that is open", async () => {
  const id = await open(fixture("shop"));
  assert.equal((await t.get(`/source?project=${encodeURIComponent(id)}`)).status, 400);
  assert.equal((await byFile("nope", "cart.py")).status, 404);
});
