import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startCore } from "../src/core/server.ts";

// Ticket plugin-system/02: the kernel loads a plugin from a folder of the plugin store, activates its host half, and can undo everything it added.
const scratch = mkdtempSync(join(tmpdir(), "aidea-plugins-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

const log = (globalThis as any).__plugLog ??= [] as string[];
const base = (id: string, extra: object = {}) => ({ id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...extra });
const GOOD = `export function activate(ctx) {
  globalThis.__plugLog.push("good:activate");
  ctx.services.provide("fixture.hello", { hi: true });
  ctx.effect(() => globalThis.__plugLog.push("good:effect1"));
  ctx.effect(() => globalThis.__plugLog.push("good:effect2"));
  return () => globalThis.__plugLog.push("good:returned");
}`;

let n = 0;
// Builds a store with the given plugins ({ folder: { manifest, main } }) and starts a core on it.
async function open(plugins: Record<string, { manifest?: unknown; raw?: string; files?: Record<string, string> }>) {
  const store = join(scratch, `store${n++}`);
  mkdirSync(store, { recursive: true });
  for (const [folder, p] of Object.entries(plugins)) {
    const dir = join(store, folder);
    mkdirSync(dir, { recursive: true });
    if (p.manifest !== undefined) writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify(p.manifest));
    if (p.raw !== undefined) writeFileSync(join(dir, "aidea-plugin.json"), p.raw);
    for (const [name, text] of Object.entries(p.files ?? {})) writeFileSync(join(dir, name), text);
  }
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
  const list = async () => (await (await fetch(core.url + "/plugins")).json()) as { plugins: { id: string; title: string; version: string; state: string; reason?: string }[]; services: { key: string; owner: string }[] };
  const act = (what: "activate" | "deactivate", id: string) => fetch(core.url + `/plugins/${what}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
  return { core, list, act, byId: async (id: string) => (await list()).plugins.find((p) => p.id === id) };
}

test("a core with no plugin store lists no plugins", async () => {
  const core = await startCore({ port: 0, builtinPluginsDir: false });
  try {
    assert.deepEqual(await (await fetch(core.url + "/plugins")).json(), { plugins: [], services: [], events: [] });
  } finally { core.close(); }
});

test("a good plugin is listed active with its title and version, and what it provides is registered", async () => {
  const t = await open({ good: { manifest: base("fixture.good"), files: { "main.js": GOOD } } });
  try {
    const p = await t.byId("fixture.good");
    assert.deepEqual([p?.title, p?.version, p?.state], ["Title of fixture.good", "1.0.0", "active"]);
    assert.deepEqual((await t.list()).services, [{ key: "fixture.hello", owner: "fixture.good" }]);
  } finally { t.core.close(); }
});

test("deactivating undoes everything in reverse order, the returned function last, and leaves the registries as they were", async () => {
  const t = await open({ good: { manifest: base("fixture.good"), files: { "main.js": GOOD } } });
  try {
    log.length = 0;
    assert.equal((await t.act("deactivate", "fixture.good")).status, 200);
    assert.deepEqual(log, ["good:effect2", "good:effect1", "good:returned"]);
    assert.equal((await t.byId("fixture.good"))?.state, "inactive");
    assert.deepEqual((await t.list()).services, []);
  } finally { t.core.close(); }
});

test("a plugin can be activated again after it was deactivated", async () => {
  const t = await open({ good: { manifest: base("fixture.good"), files: { "main.js": GOOD } } });
  try {
    await t.act("deactivate", "fixture.good");
    assert.equal((await t.act("activate", "fixture.good")).status, 200);
    assert.equal((await t.byId("fixture.good"))?.state, "active");
    assert.deepEqual((await t.list()).services.map((s) => s.key), ["fixture.hello"]);
  } finally { t.core.close(); }
});

test("a plugin that throws while activating is reported as failed and the others stay active", async () => {
  const t = await open({
    boom: { manifest: base("fixture.boom"), files: { "main.js": `export function activate() { throw new Error("it broke"); }` } },
    good: { manifest: base("fixture.good"), files: { "main.js": GOOD } },
  });
  try {
    const boom = await t.byId("fixture.boom");
    assert.equal(boom?.state, "failed");
    assert.match(boom?.reason ?? "", /it broke/);
    assert.equal((await t.byId("fixture.good"))?.state, "active");
  } finally { t.core.close(); }
});

test("what a failing plugin registered before it threw is undone", async () => {
  const t = await open({ half: { manifest: base("fixture.half"), files: { "main.js": `export function activate(ctx) { ctx.services.provide("fixture.half", 1); throw new Error("late"); }` } } });
  try {
    assert.equal((await t.byId("fixture.half"))?.state, "failed");
    assert.deepEqual((await t.list()).services, []);
  } finally { t.core.close(); }
});

test("a main file with no activate function, and an activate that returns a promise, are handled", async () => {
  const t = await open({
    none: { manifest: base("fixture.none"), files: { "main.js": `export const x = 1;` } },
    slow: { manifest: base("fixture.slow"), files: { "main.js": `export async function activate(ctx) { await new Promise((r) => setTimeout(r, 20)); ctx.services.provide("fixture.slow", 1); }` } },
  });
  try {
    const none = await t.byId("fixture.none");
    assert.equal(none?.state, "failed");
    assert.match(none?.reason ?? "", /activate/);
    assert.equal((await t.byId("fixture.slow"))?.state, "active");
    assert.ok((await t.list()).services.some((s) => s.key === "fixture.slow"));
  } finally { t.core.close(); }
});

test("a plugin with only an interface half is active, and one with neither half is invalid", async () => {
  const t = await open({
    ui: { manifest: { ...base("fixture.ui"), main: undefined, ui: "ui.js" }, files: { "ui.js": "export function activate() {}" } },
    empty: { manifest: { ...base("fixture.empty"), main: undefined } },
  });
  try {
    assert.equal((await t.byId("fixture.ui"))?.state, "active");
    const empty = (await t.list()).plugins.find((p) => p.id === "empty" || p.id === "fixture.empty");
    assert.equal(empty?.state, "failed");
    assert.match(empty?.reason ?? "", /main|ui/);
  } finally { t.core.close(); }
});

const invalid: [string, { manifest?: unknown; raw?: string }, RegExp][] = [
  ["no manifest file", {}, /aidea-plugin\.json/],
  ["a manifest that is not JSON", { raw: "{ nope" }, /aidea-plugin\.json/],
  ["no title", { manifest: { ...base("fixture.bad"), title: undefined } }, /title/],
  ["no publisher", { manifest: { ...base("fixture.bad"), publisher: undefined } }, /publisher/],
  ["a bad id", { manifest: base("Bad Id!") }, /id/],
  ["a bad version", { manifest: { ...base("fixture.bad"), version: "one" } }, /version/],
  ["an api that is not MAJOR.MINOR", { manifest: { ...base("fixture.bad"), api: "latest" } }, /api/],
  ["a description that is too long", { manifest: { ...base("fixture.bad"), description: "x".repeat(201) } }, /description/],
  ["a main path that leaves the folder", { manifest: { ...base("fixture.bad"), main: "../outside.js" } }, /main/],
  ["an absolute main path", { manifest: { ...base("fixture.bad"), main: "/etc/passwd" } }, /main/],
  ["a capability that does not exist", { manifest: { ...base("fixture.bad"), capabilities: ["teleport"] } }, /capabilities/],
  ["requires that is not a list", { manifest: { ...base("fixture.bad"), requires: "x" } }, /requires/],
  ["an event with an unknown mode", { manifest: { ...base("fixture.bad"), events: { went: { mode: "shout", version: 1 } } } }, /events/],
];
for (const [name, p, field] of invalid) {
  test(`a plugin with ${name} is failed with a reason that names the problem, and nothing of it runs`, async () => {
    const marker = `ran:${n}`;
    const t = await open({ bad: { ...p, files: { "main.js": `globalThis.__plugLog.push(${JSON.stringify(marker)}); export function activate() {}` } } });
    try {
      const entry = (await t.list()).plugins[0];
      assert.equal(entry?.state, "failed");
      assert.match(entry?.reason ?? "", field);
      assert.ok(!log.includes(marker), "the code of an invalid plugin must not run");
    } finally { t.core.close(); }
  });
}

test("two folders with the same plugin id: the second is failed", async () => {
  const t = await open({
    a: { manifest: base("fixture.same"), files: { "main.js": GOOD.replace("fixture.hello", "fixture.a") } },
    b: { manifest: base("fixture.same"), files: { "main.js": GOOD.replace("fixture.hello", "fixture.b") } },
  });
  try {
    const states = (await t.list()).plugins.map((p) => p.state).sort();
    assert.deepEqual(states, ["active", "failed"]);
  } finally { t.core.close(); }
});

test("folders that start with a dot and loose files in the store are not plugins", async () => {
  const t = await open({ ".quarantine": { manifest: base("fixture.hidden"), files: { "main.js": GOOD } }, good: { manifest: base("fixture.good"), files: { "main.js": GOOD.replace("fixture.hello", "fixture.g2") } } });
  try {
    assert.deepEqual((await t.list()).plugins.map((p) => p.id), ["fixture.good"]);
  } finally { t.core.close(); }
});

test("activating or deactivating an unknown plugin is a 404, and a body without an id is a 400", async () => {
  const t = await open({});
  try {
    assert.equal((await t.act("activate", "nope")).status, 404);
    assert.equal((await fetch(t.core.url + "/plugins/activate", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })).status, 400);
  } finally { t.core.close(); }
});
