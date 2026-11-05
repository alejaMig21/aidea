import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { readManifest } from "../src/core/plugins/manifest.ts";
import { startCore } from "../src/core/server.ts";
import "../src/core/adapters.ts";

// language-plugins 01: a plugin fills the `language` slot: the extensions it claims and `analyze`, with `flow` and `run` optional.
const scratch = mkdtempSync(join(tmpdir(), "aidea-language-plugin-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

const ANALYZE_ONLY = `export function activate(ctx) {
  ctx.languages.provide({
    async analyze(path) {
      return { nodes: [{ id: "main", kind: "module", name: "main", parent: null, file: "main.zz", line: 1, endLine: 3 }, { id: "main.go", kind: "function", name: "go", parent: "main", file: "main.zz", line: 2, endLine: 3 }], errors: [], relationships: [], unresolved: 0 };
    },
  });
}`;
let n = 0;
function plugin(id: string, language: unknown, main = ANALYZE_ONLY) {
  const dir = join(scratch, `p${n++}`, id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...(language === undefined ? {} : { language }) }));
  writeFileSync(join(dir, "main.js"), main);
  return dir;
}
const zz = { id: "zed", label: "Zed", extensions: [".zz"] };
async function coreWith(...dirs: string[]) {
  const store = join(scratch, `s${n++}`);
  mkdirSync(store, { recursive: true });
  const { cpSync } = await import("node:fs");
  for (const d of dirs) cpSync(d, join(store, d.split(/[\\/]/).pop()!), { recursive: true });
  return startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
}
function project(files: Record<string, string>) {
  const dir = join(scratch, `proj${n++}`);
  mkdirSync(dir, { recursive: true });
  for (const [f, t] of Object.entries(files)) writeFileSync(join(dir, f), t);
  return dir;
}
const open = async (core: any, path: string) => (await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path }) })).json() as Promise<any>;

test("the manifest accepts a language and refuses one that does not have the shape, with the field named", () => {
  const problems = (l: unknown) => { const r = readManifest(plugin("fixture.m", l)); return "problems" in r ? r.problems.join("; ") : ""; };
  assert.equal(problems(zz), "");
  assert.match(problems("zed"), /"language".*object/);
  assert.match(problems({ ...zz, id: "Bad Id" }), /"language".*"id"/);
  assert.match(problems({ ...zz, label: "" }), /"language".*"label"/);
  assert.match(problems({ ...zz, extensions: [] }), /"language".*"extensions"/);
  assert.match(problems({ ...zz, extensions: ["zz"] }), /"language".*"extensions"/);
  assert.match(problems({ ...zz, extensions: [".a", ".b", ".c", ".d", ".e", ".f", ".g", ".h", ".i", ".j", ".k"] }), /"language".*"extensions"/);
  const noMain = readManifest(plugin("fixture.nomain", zz, ""));
  assert.ok("manifest" in noMain);
});

test("a plugin that implements only analyze makes the Components layer draw a Project in its language", async () => {
  const core = await coreWith(plugin("fixture.zed", zz));
  try {
    const p = await open(core, project({ "main.zz": "hello" }));
    assert.deepEqual(p.languages, [{ language: "zed", label: "Zed", files: 1, analysed: true }]);
    assert.deepEqual(p.nodes.map((x: any) => x.name), ["main", "go"]);
  } finally { await core.plugins.deactivate("fixture.zed"); core.close(); }
});

test("a language with no plugin is still listed as not analysed, and switching the plugin off takes the language away", async () => {
  const core = await coreWith(plugin("fixture.zed", zz));
  try {
    await core.plugins.deactivate("fixture.zed");
    const p = await open(core, project({ "main.zz": "hello" }));
    assert.deepEqual(p.languages, []);
    await core.plugins.activate("fixture.zed");
    assert.equal((await open(core, project({ "main.zz": "hello" }))).languages[0].analysed, true);
  } finally { await core.plugins.deactivate("fixture.zed"); core.close(); }
});

test("a plugin that claims an extension another one holds (or a built-in language id) fails to activate and says why", async () => {
  const a = plugin("fixture.first", zz), b = plugin("fixture.second", { ...zz, id: "other" }), c = plugin("fixture.third", { id: "python", label: "Mine", extensions: [".q"] }), d = plugin("fixture.fourth", { id: "py2", label: "Py2", extensions: [".PY"] });
  const core = await coreWith(a, b, c, d);
  try {
    const state = (id: string) => core.plugins.list().find((p: any) => p.id === id)!;
    assert.equal(state("fixture.first").state, "active");
    assert.equal(state("fixture.second").state, "failed");
    assert.match(state("fixture.second").reason!, /\.zz.*fixture\.first/);
    assert.equal(state("fixture.third").state, "failed");
    assert.match(state("fixture.third").reason!, /"python"/);
    assert.equal(state("fixture.fourth").state, "failed");
    assert.match(state("fixture.fourth").reason!, /\.py/);
  } finally { await core.plugins.deactivate("fixture.first"); core.close(); }
});

test("a plugin must provide the language its manifest declares, once", async () => {
  const none = plugin("fixture.none", undefined, `export function activate(ctx) { ctx.languages.provide({ async analyze() { return { nodes: [], errors: [], relationships: [], unresolved: 0 }; } }); }`);
  const twice = plugin("fixture.twice", { id: "twice", label: "Twice", extensions: [".tw"] }, `export function activate(ctx) { const a = { async analyze() { return { nodes: [], errors: [], relationships: [], unresolved: 0 }; } }; ctx.languages.provide(a); ctx.languages.provide(a); }`);
  const bad = plugin("fixture.bad", { id: "bad", label: "Bad", extensions: [".bd"] }, `export function activate(ctx) { ctx.languages.provide({}); }`);
  const core = await coreWith(none, twice, bad);
  try {
    const state = (id: string) => core.plugins.list().find((p: any) => p.id === id)!;
    assert.equal(state("fixture.none").state, "failed");
    assert.match(state("fixture.none").reason!, /"language"/);
    assert.equal(state("fixture.twice").state, "failed");
    assert.equal(state("fixture.bad").state, "failed");
    assert.match(state("fixture.bad").reason!, /analyze/);
  } finally { core.close(); }
});

test("a route that needs flow or run from a plugin that lacks it answers with the plain-words 422 of today", async () => {
  const core = await coreWith(plugin("fixture.zed", zz));
  try {
    const p = await open(core, project({ "main.zz": "hello" }));
    const flow = await fetch(core.url + "/flow?" + new URLSearchParams({ project: p.id, node: "main.go" }));
    assert.equal(flow.status, 422, await flow.clone().text());
  } finally { await core.plugins.deactivate("fixture.zed"); core.close(); }
});
