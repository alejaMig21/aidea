import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startCore } from "../src/core/server.ts";

// Ticket plugin-system/09: the API version a plugin asks for is checked at install and at load; a missing service keeps a plugin inactive with its reason; things come back when what they need does.
const scratch = mkdtempSync(join(tmpdir(), "aidea-versions-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));
const log = ((globalThis as any).__plugLog ??= [] as string[]) as string[];

const manifest = (id: string, extra: object = {}) => ({ id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...extra });
const QUIET = `export function activate() {}`;
let n = 0;
function plugin(store: string, folder: string, m: object, main = QUIET) {
  const dir = join(store, folder);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify(m));
  writeFileSync(join(dir, "main.js"), main);
}
async function start(store: string) {
  mkdirSync(store, { recursive: true });
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
  const post = async (path: string, body: unknown) => {
    const res = await fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as any };
  };
  const find = async (id: string) => (((await (await fetch(core.url + "/plugins")).json()) as any).plugins as { id: string; state: string; reason?: string }[]).find((p) => p.id === id);
  return { core, post, find };
}
const newStore = () => join(scratch, `store${n++}`);
const PROVIDES = (key: string) => `export function activate(ctx) { ctx.services.provide("${key}", 1); }`;

test("a plugin that asks for an API version aidea does not offer is incompatible, with the reason, and its code never runs", async () => {
  const store = newStore();
  plugin(store, "old", manifest("fixture.old", { api: "0.9" }), `globalThis.__plugLog.push("incompatible ran"); export function activate() {}`);
  plugin(store, "future", manifest("fixture.future", { api: "1.0" }));
  plugin(store, "ok", manifest("fixture.ok"));
  const t = await start(store);
  try {
    const old = await t.find("fixture.old");
    assert.equal(old?.state, "incompatible");
    assert.match(old?.reason ?? "", /0\.9/);
    assert.match(old?.reason ?? "", /0\.1/);
    assert.equal((await t.find("fixture.future"))?.state, "incompatible");
    assert.equal((await t.find("fixture.ok"))?.state, "active");
    assert.ok(!log.includes("incompatible ran"));
    assert.equal((await t.post("/plugins/enable", { id: "fixture.old" })).body.status, "failed", "enabling does not make it compatible");
  } finally { t.core.close(); }
});

test("installing an incompatible plugin is refused", async () => {
  const t = await start(newStore());
  try {
    const dir = join(scratch, `src${n++}`);
    plugin(dir, ".", manifest("fixture.old", { api: "0.9" }));
    const q = await t.post("/plugins/quarantine", { source: dir });
    const res = await t.post("/plugins/install", { id: q.body.id, confirm: q.body.report.findings.map((f: any) => f.key) });
    assert.equal(res.status, 409);
    assert.match(res.body.error, /API/);
    assert.equal(await t.find("fixture.old"), undefined);
  } finally { t.core.close(); }
});

test("a plugin whose required service is missing stays inactive and says which, without running", async () => {
  const store = newStore();
  plugin(store, "needy", manifest("fixture.needy", { requires: ["fixture.svc"] }), `globalThis.__plugLog.push("needy ran"); export function activate() {}`);
  const t = await start(store);
  try {
    log.length = 0;
    const p = await t.find("fixture.needy");
    assert.equal(p?.state, "inactive");
    assert.match(p?.reason ?? "", /needs the service "fixture\.svc"/);
    assert.deepEqual(log, []);
  } finally { t.core.close(); }
});

test("load order follows the services: a plugin that needs one starts after the one that provides it, whatever the folder names", async () => {
  const store = newStore();
  plugin(store, "a-needs", manifest("fixture.needs", { requires: ["fixture.svc"] }));
  plugin(store, "z-provides", manifest("fixture.provides", { provides: ["fixture.svc"] }), PROVIDES("fixture.svc"));
  const t = await start(store);
  try {
    assert.deepEqual([(await t.find("fixture.needs"))?.state, (await t.find("fixture.provides"))?.state], ["active", "active"]);
  } finally { t.core.close(); }
});

test("switching off or removing the provider leaves the plugin that needs it inactive with a reason, and bringing it back reactivates that one", async () => {
  const store = newStore();
  plugin(store, "needs", manifest("fixture.needs", { requires: ["fixture.svc"] }));
  plugin(store, "provides", manifest("fixture.provides"), PROVIDES("fixture.svc"));
  const t = await start(store);
  try {
    await t.post("/plugins/disable", { id: "fixture.provides" });
    const off = await t.find("fixture.needs");
    assert.equal(off?.state, "inactive");
    assert.match(off?.reason ?? "", /fixture\.svc/);
    await t.post("/plugins/enable", { id: "fixture.provides" });
    assert.equal((await t.find("fixture.needs"))?.state, "active", "it comes back by itself");
    await t.post("/plugins/remove", { id: "fixture.provides" });
    assert.equal((await t.find("fixture.needs"))?.state, "inactive");
  } finally { t.core.close(); }
});

test("a plugin the person switched off is not reactivated just because what it needs came back", async () => {
  const store = newStore();
  plugin(store, "needs", manifest("fixture.needs", { requires: ["fixture.svc"] }));
  plugin(store, "provides", manifest("fixture.provides"), PROVIDES("fixture.svc"));
  const t = await start(store);
  try {
    await t.post("/plugins/disable", { id: "fixture.needs" });
    await t.post("/plugins/disable", { id: "fixture.provides" });
    await t.post("/plugins/enable", { id: "fixture.provides" });
    assert.equal((await t.find("fixture.needs"))?.state, "inactive");
    assert.match((await t.find("fixture.needs"))?.reason ?? "", /switched off/);
  } finally { t.core.close(); }
});

test("two plugins that need each other stay inactive and say so; nothing hangs", async () => {
  const store = newStore();
  plugin(store, "a", manifest("fixture.a", { requires: ["fixture.b.svc"], provides: ["fixture.a.svc"] }), PROVIDES("fixture.a.svc"));
  plugin(store, "b", manifest("fixture.b", { requires: ["fixture.a.svc"], provides: ["fixture.b.svc"] }), PROVIDES("fixture.b.svc"));
  const t = await start(store);
  try {
    for (const id of ["fixture.a", "fixture.b"]) {
      const p = await t.find(id);
      assert.equal(p?.state, "inactive", id);
      assert.match(p?.reason ?? "", /needs the service/);
    }
  } finally { t.core.close(); }
});
