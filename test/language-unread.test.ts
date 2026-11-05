import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { detectLanguages, languageOfFile } from "../src/core/languages.ts";
import { startCore } from "../src/core/server.ts";
import "../src/core/adapters.ts";

// language-plugins 04: a Project in a language that no enabled plugin claims is still named, so the interface can say that no plugin reads it and offer the way forward.
const scratch = mkdtempSync(join(tmpdir(), "aidea-unread-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }));
function project(files: Record<string, string>) {
  const dir = mkdtempSync(join(scratch, "p"));
  for (const [f, t] of Object.entries(files)) { mkdirSync(join(dir, f, ".."), { recursive: true }); writeFileSync(join(dir, f), t); }
  return dir;
}

test("files of languages aidea knows by name but no plugin reads are listed as not analysed, most files first", () => {
  const dir = project({ "a.r": "x <- 1", "b.R": "y <- 2", "c.rs": "fn main() {}", "d.txt": "hello", "e.go": "package main" });
  const found = detectLanguages(dir);
  assert.deepEqual(found.map((l) => [l.label, l.files, l.analysed]), [["R", 2, false], ["Rust", 1, false], ["Go", 1, false]]);
  assert.deepEqual(languageOfFile("script.r"), { language: "r", label: "R" });
});

test("a Project in such a language opens: no nodes, no error, and the languages are named", async () => {
  const core = await startCore({ port: 0, builtinPluginsDir: false, pluginsDir: join(scratch, "store") });
  try {
    const res = await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project({ "analysis.r": "x <- 1" }) }) });
    assert.equal(res.status, 201);
    const body = await res.json() as any;
    assert.deepEqual(body.nodes, []);
    assert.deepEqual(body.languages, [{ language: "r", label: "R", files: 1, analysed: false }]);
  } finally { core.close(); }
});

test("a language plugin may still claim the extensions of a language that is only named: the name does not block it", async () => {
  const store = mkdtempSync(join(scratch, "s"));
  const dir = join(store, "r-reader");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id: "r-reader", version: "1.0.0", title: "R", description: "Reads R.", publisher: "tests", api: "0.1", main: "main.js", language: { id: "r", label: "R", extensions: [".r"] } }));
  writeFileSync(join(dir, "main.js"), `export function activate(ctx) { ctx.languages.provide({ async analyze() { return { nodes: [{ id: "analysis", kind: "module", name: "analysis", parent: null, file: "analysis.r", line: 1, endLine: 1 }], errors: [], relationships: [], unresolved: 0 }; } }); }`);
  const core = await startCore({ port: 0, builtinPluginsDir: false, pluginsDir: store });
  try {
    assert.equal(core.plugins.entry("r-reader")?.state, "active");
    const body = await (await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project({ "analysis.r": "x <- 1" }) }) })).json() as any;
    assert.deepEqual(body.languages, [{ language: "r", label: "R", files: 1, analysed: true }]);
    assert.equal(body.nodes.length, 1);
  } finally { await core.plugins.deactivate("r-reader"); core.close(); }
});
