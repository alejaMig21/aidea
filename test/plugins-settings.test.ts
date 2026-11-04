import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startCore } from "../src/core/server.ts";
import { readManifest } from "../src/core/plugins/manifest.ts";

// Ticket plugin-system/13: each plugin has a private data folder and settings that follow a schema in its manifest; its secrets go to a secret store and never to a file or a log.
const scratch = mkdtempSync(join(tmpdir(), "aidea-settings-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

const SCHEMA = {
  color: { type: "choice", label: "Color", options: ["red", "blue"], default: "red" },
  retries: { type: "number", label: "Retries", default: 3 },
  name: { type: "string", label: "Name", default: "anon" },
  loud: { type: "boolean", label: "Loud", default: false },
  token: { type: "secret", label: "Token" },
};
const SECRET = "hunter2-SECRET-value";
const base = (id: string, extra: object = {}) => ({ id, version: "1.0.0", title: id, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...extra });
// Both fixtures expose what their context offers through services, so the test can look.
const MAIN = `export function activate(ctx) {
  ctx.services.provide(ctx.plugin.id + ".probe", () => ({
    keys: [Object.keys(ctx), Object.keys(ctx.data), Object.keys(ctx.settings), Object.keys(ctx.secrets)],
    dir: ctx.data.dir, color: ctx.settings.get("color"), retries: ctx.settings.get("retries"),
    token: (() => { try { return ctx.secrets.get("token"); } catch (e) { return "ERROR: " + e.message; } })(),
  }));
}`;

let n = 0;
async function start(plugins: Record<string, object>) {
  const store = join(scratch, `store${n++}`);
  mkdirSync(store, { recursive: true });
  for (const [folder, manifest] of Object.entries(plugins)) {
    mkdirSync(join(store, folder), { recursive: true });
    writeFileSync(join(store, folder, "aidea-plugin.json"), JSON.stringify(manifest));
    writeFileSync(join(store, folder, "main.js"), MAIN);
  }
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
  const get = async (path: string) => { const r = await fetch(core.url + path); return { status: r.status, text: await r.text() }; };
  const post = async (path: string, body: unknown) => {
    const r = await fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const text = await r.text();
    return { status: r.status, text, body: JSON.parse(text) as any };
  };
  const probe = (id: string) => core.plugins.callService(`${id}.probe`) as any;
  return { core, store, get, post, probe };
}
const allFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? allFiles(join(dir, e.name)) : [join(dir, e.name)]));

test("the manifest checks the shape of the settings schema", () => {
  const dir = join(scratch, `m${n++}`);
  mkdirSync(dir, { recursive: true });
  const problemsOf = (settings: unknown) => {
    writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify(base("fixture.m", { settings })));
    writeFileSync(join(dir, "main.js"), "export function activate() {}");
    const r = readManifest(dir);
    return "problems" in r ? r.problems.join(" | ") : "";
  };
  assert.equal(problemsOf(SCHEMA), "");
  assert.match(problemsOf({ a: { type: "colour", label: "A" } }), /settings.*type/);
  assert.match(problemsOf({ a: { type: "choice", label: "A" } }), /settings.*options/);
  assert.match(problemsOf({ a: { type: "string" } }), /settings.*label/);
  assert.match(problemsOf({ a: { type: "number", label: "A", default: "text" } }), /settings.*default/);
});

test("the settings route returns the schema with the defaults, and a secret only as set or not set", async () => {
  const t = await start({ a: base("fixture.a", { settings: SCHEMA, capabilities: ["secrets"] }) });
  try {
    const r = await t.get("/plugins/fixture.a/settings");
    assert.equal(r.status, 200);
    const body = JSON.parse(r.text);
    assert.deepEqual(body.schema, SCHEMA);
    assert.deepEqual(body.values, { color: "red", retries: 3, name: "anon", loud: false, token: { set: false } });
    assert.equal((await t.get("/plugins/nobody/settings")).status, 404);
  } finally { t.core.close(); }
});

test("valid values are saved, kept in the plugin's own data folder, and the plugin reads them", async () => {
  const t = await start({ a: base("fixture.a", { settings: SCHEMA }) });
  try {
    const saved = await t.post("/plugins/fixture.a/settings", { values: { color: "blue", retries: 5 } });
    assert.equal(saved.status, 200);
    assert.deepEqual(JSON.parse(readFileSync(join(t.store, ".data", "fixture.a", "settings.json"), "utf8")), { color: "blue", retries: 5 });
    assert.deepEqual([t.probe("fixture.a").color, t.probe("fixture.a").retries], ["blue", 5]);
    assert.deepEqual(JSON.parse((await t.get("/plugins/fixture.a/settings")).text).values.color, "blue");
  } finally { t.core.close(); }
});

test("one invalid value saves nothing at all, and the answer names each bad field", async () => {
  const t = await start({ a: base("fixture.a", { settings: SCHEMA }) });
  try {
    const r = await t.post("/plugins/fixture.a/settings", { values: { color: "green", retries: "many", name: "ok", ghost: 1 } });
    assert.equal(r.status, 400);
    assert.deepEqual(Object.keys(r.body.errors).sort(), ["color", "ghost", "retries"]);
    assert.equal(existsSync(join(t.store, ".data", "fixture.a", "settings.json")), false);
    assert.equal(t.probe("fixture.a").color, "red");
    for (const bad of [{}, { values: 5 }, { values: [] }]) assert.equal((await t.post("/plugins/fixture.a/settings", bad)).status, 400);
  } finally { t.core.close(); }
});

test("a plugin's context gives it its own data folder and nothing that leads to another plugin's", async () => {
  const t = await start({ a: base("fixture.a", { settings: SCHEMA }), b: base("fixture.b", { settings: SCHEMA }) });
  try {
    const a = t.probe("fixture.a"), b = t.probe("fixture.b");
    assert.equal(a.dir, join(t.store, ".data", "fixture.a"));
    assert.equal(b.dir, join(t.store, ".data", "fixture.b"));
    assert.ok(statSync(a.dir).isDirectory());
    assert.deepEqual(a.keys[1], ["dir"]);
    assert.deepEqual(a.keys[2], ["get"]);
    assert.deepEqual(a.keys[3], ["get"]);
    assert.ok(!a.keys[0].some((k: string) => /plugins|manager|quarantine|store/i.test(k)), a.keys[0].join());
  } finally { t.core.close(); }
});

test("a secret goes to the secret store: never to a file, a log or an answer, and only a plugin that declared it can read it", async () => {
  const t = await start({ a: base("fixture.a", { settings: SCHEMA, capabilities: ["secrets"] }), b: base("fixture.b", { settings: SCHEMA }) });
  try {
    const saved = await t.post("/plugins/fixture.a/settings", { values: { token: SECRET, name: "visible" } });
    assert.equal(saved.status, 200);
    assert.ok(!saved.text.includes(SECRET));
    assert.deepEqual(JSON.parse((await t.get("/plugins/fixture.a/settings")).text).values.token, { set: true });
    assert.ok(!(await t.get("/plugins/fixture.a/settings")).text.includes(SECRET));
    assert.ok(!(await t.get("/plugins")).text.includes(SECRET));
    assert.equal(t.probe("fixture.a").token, SECRET, "the plugin that declared the capability reads it");
    assert.match(String(t.probe("fixture.b").token), /^ERROR: .*secrets/i, "a plugin that did not declare it cannot");
    for (const file of allFiles(t.store)) assert.ok(!readFileSync(file).includes(SECRET), `${file} holds the secret`);
    assert.ok(!JSON.stringify(t.core.plugins.logs()).includes(SECRET));
    // An empty string clears it.
    await t.post("/plugins/fixture.a/settings", { values: { token: "" } });
    assert.deepEqual(JSON.parse((await t.get("/plugins/fixture.a/settings")).text).values.token, { set: false });
  } finally { t.core.close(); }
});

test("removing a plugin together with its data takes the settings with it", async () => {
  const t = await start({ a: base("fixture.a", { settings: SCHEMA }) });
  try {
    await t.post("/plugins/fixture.a/settings", { values: { name: "gone soon" } });
    assert.ok(existsSync(join(t.store, ".data", "fixture.a", "settings.json")));
    const r = await t.post("/plugins/remove", { id: "fixture.a", deleteData: true });
    assert.equal(r.status, 200);
    assert.equal(existsSync(join(t.store, ".data", "fixture.a")), false);
  } finally { t.core.close(); }
});
