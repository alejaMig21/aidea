import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startTestCore } from "./helpers.ts";

const scratch = mkdtempSync(join(tmpdir(), "aidea-new-"));
let t: Awaited<ReturnType<typeof startTestCore>>;
before(async () => {
  t = await startTestCore();
});
after(() => {
  t.core.close();
  rmSync(scratch, { recursive: true, force: true });
});

const create = (parent: string, name: unknown) => t.post("/projects/new", { parent, name });

test("creating with a valid parent and name makes the folder, opens it and records it in the recents", async () => {
  const res = await create(scratch, "fresh");
  assert.equal(res.status, 201);
  const project = (await res.json()) as { id: string; name: string; path: string };
  assert.equal(project.name, "fresh");
  assert.equal(project.path, join(scratch, "fresh"));
  assert.deepEqual(readdirSync(project.path), []);
  const open = (await (await t.get("/projects")).json()) as { id: string }[];
  assert.ok(open.some((p) => p.id === project.id));
  const recents = (await (await t.get("/recents")).json()) as { path: string }[];
  assert.equal(recents[0].path, project.path);
});

test("a name that already exists in the parent is refused and nothing is overwritten", async () => {
  const taken = join(scratch, "taken");
  mkdirSync(taken);
  writeFileSync(join(taken, "keep.txt"), "mine");
  const res = await create(scratch, "taken");
  assert.equal(res.status, 400);
  assert.match(((await res.json()) as { error: string }).error, /already exists/);
  assert.equal(readFileSync(join(taken, "keep.txt"), "utf8"), "mine");
  writeFileSync(join(scratch, "afile"), "x");
  assert.equal((await create(scratch, "afile")).status, 400);
});

for (const name of ["", "  ", "../x", "a/b", "a\\b", "..", ".", "con", "NUL.txt", "a:b", "a*b", 'a"b', "a<b", "a|b", "a?b", "dot.", "space ", 42, undefined]) {
  test(`invalid folder name ${JSON.stringify(name)} is refused with a reason and creates nothing`, async () => {
    const before = readdirSync(scratch).sort();
    const res = await create(scratch, name);
    assert.equal(res.status, 400);
    assert.ok(((await res.json()) as { error: string }).error.length > 0);
    assert.deepEqual(readdirSync(scratch).sort(), before);
    assert.ok(!existsSync(join(scratch, "..", "x")));
  });
}

test("a parent that does not exist or is not a directory is refused", async () => {
  const missing = join(scratch, "nope");
  assert.equal((await create(missing, "x")).status, 400);
  assert.ok(!existsSync(missing));
  assert.equal((await create(join(scratch, "afile"), "x")).status, 400);
  assert.equal((await t.post("/projects/new", { name: "x" })).status, 400);
});
