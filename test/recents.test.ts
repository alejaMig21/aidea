import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

type Recent = { path: string; name: string; openedAt: string; available: boolean };

const scratch = mkdtempSync(join(tmpdir(), "aidea-recents-"));
const store = join(scratch, "store", "recents.json");
const dirs = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = join(scratch, `p${i}`);
    mkdirSync(d, { recursive: true });
    return d;
  });

const start = async () => {
  const core = await startCore({ port: 0, recentsFile: store });
  const post = (path: string, body: unknown) =>
    fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const recents = async () => (await (await fetch(core.url + "/recents")).json()) as Recent[];
  return { core, post, recents };
};

let t: Awaited<ReturnType<typeof start>>;
before(async () => {
  t = await start();
});
after(() => {
  t.core.close();
  rmSync(scratch, { recursive: true, force: true });
});

test("opening a Project makes it appear first in the recents list", async () => {
  await t.post("/projects", { path: fixture("shop") });
  const list = await t.recents();
  assert.equal(list[0].path, fixture("shop"));
  assert.equal(list[0].name, "shop");
  assert.equal(list[0].available, true);
  assert.ok(!Number.isNaN(Date.parse(list[0].openedAt)));
});

test("reopening the same path moves it to the top without duplicating it", async () => {
  const [a] = dirs(1);
  await t.post("/projects", { path: a });
  await t.post("/projects", { path: fixture("shop") });
  await t.post("/projects", { path: a });
  const paths = (await t.recents()).map((r) => r.path);
  assert.equal(paths[0], a);
  assert.equal(paths.filter((p) => p === a).length, 1);
  assert.equal(paths.filter((p) => p === fixture("shop")).length, 1);
});

test("the 21st distinct Project drops the oldest, newest first", async () => {
  const all = dirs(21);
  for (const d of all) await t.post("/projects", { path: d });
  const paths = (await t.recents()).map((r) => r.path);
  assert.equal(paths.length, 20);
  assert.equal(paths[0], all[20]);
  assert.ok(!paths.includes(all[0]));
});

test("a recent whose folder no longer exists is listed as unavailable, not removed", async () => {
  const gone = join(scratch, "gone");
  mkdirSync(gone);
  await t.post("/projects", { path: gone });
  rmSync(gone, { recursive: true });
  const entry = (await t.recents()).find((r) => r.path === gone);
  assert.equal(entry?.available, false);
});

test("forgetting an entry removes only the entry, never the folder", async () => {
  const [keep] = dirs(1);
  await t.post("/projects", { path: keep });
  const res = await t.post("/recents/forget", { path: keep });
  assert.equal(res.status, 200);
  assert.ok(!(await t.recents()).some((r) => r.path === keep));
  assert.ok(existsSync(keep));
});

test("forgetting needs a path string", async () => {
  assert.equal((await t.post("/recents/forget", {})).status, 400);
});

test("a path that does not exist or is not a directory is refused and not remembered", async () => {
  const missing = join(scratch, "nope");
  const file = fixture("shop/main.py");
  assert.equal((await t.post("/projects", { path: missing })).status, 400);
  assert.equal((await t.post("/projects", { path: file })).status, 400);
  const paths = (await t.recents()).map((r) => r.path);
  assert.ok(!paths.includes(missing) && !paths.includes(file));
});

test("entries survive a core restart", async () => {
  const [d] = dirs(1);
  await t.post("/projects", { path: d });
  const before = await t.recents();
  t.core.close();
  t = await start();
  assert.deepEqual(await t.recents(), before);
});
