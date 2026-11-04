import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { checkPlugin } from "../src/core/plugins/testkit.ts";

// Ticket plugin-system/17: a tool for plugin authors. It boots the real host with one plugin, activates it, deactivates it, and says whether every registry is back to where it started; it also runs the contract of each kind of plugin (Panel, guard rule).
const scratch = mkdtempSync(join(tmpdir(), "aidea-testkit-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

let n = 0;
function plugin(files: Record<string, string>, id = `fixture.kit${n}`) {
  const dir = join(scratch, `p${n++}`);
  mkdirSync(dir, { recursive: true });
  const manifest = { id, version: "1.0.0", title: id, description: "A fixture.", publisher: "tests", api: "0.1", ...(files["main.js"] ? { main: "main.js" } : {}), ...(files["ui.js"] ? { ui: "ui.js" } : {}) };
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify(manifest));
  for (const [f, t] of Object.entries(files)) writeFileSync(join(dir, f), t);
  return dir;
}

test("a plugin that undoes everything passes, and the report says which kinds it is", async () => {
  const dir = plugin({
    "main.js": `export function activate(ctx) { ctx.services.provide("fixture.svc", 1); ctx.guards.add(() => ({ decision: "allow" })); ctx.on("x/y", () => {}); }`,
    "ui.js": `export function activate(ui) { return ui.slots.add("layout.panel", { id: "p", title: "P", render() {} }); }`,
  });
  const r = await checkPlugin(dir);
  assert.deepEqual(r.problems, []);
  assert.equal(r.ok, true);
  assert.deepEqual(r.kinds.sort(), ["guard", "panel"]);
});

test("it reports a leak when the plugin forgets to undo something it started", async () => {
  // The plugin activates once per round, so it leaks more than one timer: keep them all to clear them.
  (globalThis as any).__kitLeaks = [];
  const dir = plugin({ "main.js": `export function activate() { globalThis.__kitLeaks.push(setInterval(() => {}, 1e6)); }` });
  try {
    const r = await checkPlugin(dir);
    assert.equal(r.ok, false);
    assert.ok(r.problems.some((p) => /leak/i.test(p) && /Timeout/.test(p)), r.problems.join(" | "));
  } finally { for (const t of (globalThis as any).__kitLeaks) clearInterval(t); }
});

test("a plugin that does clean up what it started passes the same check", async () => {
  const dir = plugin({ "main.js": `export function activate(ctx) { const t = setInterval(() => {}, 1e6); ctx.effect(() => clearInterval(t)); }` });
  assert.deepEqual((await checkPlugin(dir)).problems, []);
});

test("it reports a plugin that does not activate, with the reason", async () => {
  const dir = plugin({ "main.js": `export function activate() { throw new Error("nope"); }` });
  const r = await checkPlugin(dir);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(" "), /did not activate.*nope/);
});

test("the guard rule contract: a rule that throws on an ordinary action is reported", async () => {
  const dir = plugin({ "main.js": `export function activate(ctx) { ctx.guards.add(() => { throw new Error("boom"); }); }` });
  const r = await checkPlugin(dir);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(" "), /guard rule.*threw/i);
});

test("the Panel contract: an interface half without an activate function is reported", async () => {
  const dir = plugin({ "ui.js": `export const nothing = 1;` });
  const r = await checkPlugin(dir);
  assert.equal(r.ok, false);
  assert.match(r.problems.join(" "), /panel.*activate/i);
});

test("it also survives a second activate and deactivate", async () => {
  // A registry that is not undone on the second round only shows on the second round.
  const dir = plugin({ "main.js": `let once = false; export function activate(ctx) { if (once) ctx.services.provide("fixture.never-undone", 1); once = true; ctx.effect(() => {}); }` });
  assert.equal((await checkPlugin(dir)).ok, true);
});

test("the built-in Terminal plugin passes", async () => {
  const r = await checkPlugin(join(import.meta.dirname, "..", "src", "plugins", "terminal"));
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.kinds, ["panel"]);
});

test("it is documented in the skill and in the API document", () => {
  const root = join(import.meta.dirname, "..");
  for (const doc of ["docs/plugin-skill.md", "docs/plugin-api.md"]) assert.match(readFileSync(join(root, doc), "utf8"), /testkit|checkPlugin/, doc);
});
