import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startCore } from "../src/core/server.ts";

// Ticket plugin-system/07: enable, disable and remove, with one set of status words (applied, failed, restart-required) and the person's choice about the plugin's data.
const scratch = mkdtempSync(join(tmpdir(), "aidea-manage-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

const manifest = (id: string, extra: object = {}) => ({ id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...extra });
const QUIET = `export function activate(ctx) { ctx.services.provide(ctx.plugin.id + ".svc", 1); }`;
let n = 0;
function plugin(root: string, folder: string, m: object, main = QUIET) {
  const dir = join(root, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify(m));
  writeFileSync(join(dir, "main.js"), main);
  return dir;
}
async function start(opts: { store?: string; builtin?: string } = {}) {
  const store = opts.store ?? join(scratch, `store${n++}`);
  mkdirSync(store, { recursive: true });
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: opts.builtin ?? false });
  const post = async (path: string, body: unknown) => {
    const res = await fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as any };
  };
  const list = async () => ((await (await fetch(core.url + "/plugins")).json()) as any).plugins as { id: string; state: string; reason?: string; required: boolean; builtin: boolean }[];
  return { core, store, post, list, find: async (id: string) => (await list()).find((p) => p.id === id) };
}

test("disabling a plugin switches it off at once and the choice is kept for the next start; enabling brings it back", async () => {
  const store = join(scratch, `store${n++}`);
  plugin(store, "a", manifest("fixture.a"));
  const t = await start({ store });
  try {
    assert.equal((await t.find("fixture.a"))?.state, "active");
    const off = await t.post("/plugins/disable", { id: "fixture.a" });
    assert.deepEqual([off.status, off.body.status], [200, "applied"]);
    assert.equal((await t.find("fixture.a"))?.state, "inactive");
  } finally { t.core.close(); }
  const again = await start({ store });
  try {
    const p = await again.find("fixture.a");
    assert.equal(p?.state, "inactive", "it stays off after a restart");
    assert.match(p?.reason ?? "", /switched off/);
    const on = await again.post("/plugins/enable", { id: "fixture.a" });
    assert.deepEqual([on.status, on.body.status], [200, "applied"]);
    assert.equal((await again.find("fixture.a"))?.state, "active");
  } finally { again.core.close(); }
  const third = await start({ store });
  try {
    assert.equal((await third.find("fixture.a"))?.state, "active", "enabling is kept too");
  } finally { third.core.close(); }
});

test("removing a plugin that never ran in this session applies at once, and its folder is gone", async () => {
  const store = join(scratch, `store${n++}`);
  const dir = plugin(store, "a", manifest("fixture.a"));
  const first = await start({ store });
  await first.post("/plugins/disable", { id: "fixture.a" });
  first.core.close();
  const t = await start({ store }); // it starts switched off, so its code never ran here
  try {
    const res = await t.post("/plugins/remove", { id: "fixture.a" });
    assert.deepEqual([res.status, res.body.status], [200, "applied"]);
    assert.ok(!existsSync(dir));
    assert.equal(await t.find("fixture.a"), undefined);
  } finally { t.core.close(); }
});

test("removing a plugin whose code already ran asks for a restart, and still takes it out", async () => {
  const store = join(scratch, `store${n++}`);
  const dir = plugin(store, "a", manifest("fixture.a"));
  const t = await start({ store });
  try {
    const res = await t.post("/plugins/remove", { id: "fixture.a" });
    assert.deepEqual([res.status, res.body.status], [200, "restart-required"]);
    assert.ok(!existsSync(dir));
    assert.equal(await t.find("fixture.a"), undefined);
    assert.deepEqual(((await (await fetch(t.core.url + "/plugins")).json()) as any).services, [], "what it provided is gone");
  } finally { t.core.close(); }
});

test("removing asks about the data: kept unless the person says to delete it", async () => {
  const store = join(scratch, `store${n++}`);
  plugin(store, "a", manifest("fixture.a"));
  plugin(store, "b", manifest("fixture.b"));
  for (const id of ["fixture.a", "fixture.b"]) { mkdirSync(join(store, ".data", id), { recursive: true }); writeFileSync(join(store, ".data", id, "notes.txt"), "mine"); }
  const t = await start({ store });
  try {
    await t.post("/plugins/remove", { id: "fixture.a" });
    assert.ok(existsSync(join(store, ".data", "fixture.a", "notes.txt")), "the data stays by default");
    await t.post("/plugins/remove", { id: "fixture.b", deleteData: true });
    assert.ok(!existsSync(join(store, ".data", "fixture.b")), "the data goes when asked");
    assert.equal((await t.post("/plugins/remove", { id: "fixture.b", deleteData: "yes" })).status, 400);
  } finally { t.core.close(); }
});

test("a plugin that ships with aidea and is marked required cannot be disabled or removed; one that is not can be removed", async () => {
  const builtin = join(scratch, `builtin${n++}`);
  plugin(builtin, "core", manifest("fixture.core", { required: true }));
  plugin(builtin, "extra", manifest("fixture.extra"));
  const store = join(scratch, `store${n++}`);
  const t = await start({ store, builtin });
  try {
    assert.equal((await t.find("fixture.core"))?.required, true);
    assert.equal((await t.post("/plugins/disable", { id: "fixture.core" })).status, 409);
    assert.equal((await t.post("/plugins/remove", { id: "fixture.core" })).status, 409);
    assert.equal((await t.find("fixture.core"))?.state, "active");
    const gone = await t.post("/plugins/remove", { id: "fixture.extra" });
    assert.deepEqual([gone.status, gone.body.status], [200, "restart-required"]);
    assert.ok(existsSync(join(builtin, "extra")), "the files that ship with aidea are not deleted");
    assert.equal(await t.find("fixture.extra"), undefined);
  } finally { t.core.close(); }
  const again = await start({ store, builtin });
  try {
    assert.equal(await again.find("fixture.extra"), undefined, "a removed built-in plugin stays removed after a restart");
    assert.equal((await again.find("fixture.core"))?.state, "active");
  } finally { again.core.close(); }
});

test("an unknown plugin is a 404 and a body without an id is a 400", async () => {
  const t = await start();
  try {
    for (const what of ["enable", "disable", "remove"]) {
      assert.equal((await t.post(`/plugins/${what}`, { id: "nope" })).status, 404, what);
      assert.equal((await t.post(`/plugins/${what}`, {})).status, 400, what);
    }
  } finally { t.core.close(); }
});

test("a plugin that fails to activate when enabled reports failed with the reason", async () => {
  const store = join(scratch, `store${n++}`);
  plugin(store, "a", manifest("fixture.a"), `export function activate() { throw new Error("nope"); }`);
  const t = await start({ store });
  try {
    const res = await t.post("/plugins/enable", { id: "fixture.a" });
    assert.deepEqual([res.status, res.body.status], [200, "failed"]);
    assert.match(res.body.reason, /nope/);
  } finally { t.core.close(); }
});
