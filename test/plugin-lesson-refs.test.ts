import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { difference } from "../src/core/plugins/diff.ts";
import { scanPlugin } from "../src/core/plugins/scan.ts";
import { startCore } from "../src/core/server.ts";

// plugin-lessons 03: what a lesson names (its `refs`) is compared with what the plugin declares. A name that is gone is a warning, never a block.
const scratch = mkdtempSync(join(tmpdir(), "aidea-lesson-refs-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }));

const part = (refs: string[]) => ({ name: "The part", hint: "A hint.", what: "What it is.", question: "A question?", example: "An example.", narration: "A narration.", tryIt: "Try it.", refs });
let n = 0;
function plugin(id: string, o: { refs?: string[][]; noLesson?: boolean; ui?: string; version?: string; lessonName?: string } = {}) {
  const dir = join(scratch, `p${n++}`, id);
  mkdirSync(dir, { recursive: true });
  const manifest: Record<string, unknown> = {
    id, version: o.version ?? "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", ui: "ui.js", main: "main.js",
    settings: { volume: { type: "number", label: "Volume", default: 1 } }, provides: ["shop.menu"], events: { opened: { mode: "announce", version: 1 } }, capabilities: ["files"],
    teach: { view: "state", module: "teach.mjs", checks: [{ name: "has-relation", says: "A relation exists." }] },
  };
  if (!o.noLesson) { manifest.lesson = o.lessonName ?? "lesson.json"; writeFileSync(join(dir, o.lessonName ?? "lesson.json"), JSON.stringify({ parts: (o.refs ?? [[id]]).map(part) })); }
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify(manifest));
  writeFileSync(join(dir, "ui.js"), o.ui ?? `export function activate(ctx) { ctx.ui.slots.add("layout.panel", { id: "tray", title: "Tray", render() {} }); }`);
  writeFileSync(join(dir, "main.js"), "export function activate() {}");
  writeFileSync(join(dir, "teach.mjs"), "export const view = (s) => s; export const checks = {};");
  return dir;
}
const stale = (dir: string) => scanPlugin(dir).findings.filter((f) => f.id === "lesson-stale");

test("names that exist produce no warning: the plugin itself, a Panel, a setting, a service, an event, a check, a capability", () => {
  const report = scanPlugin(plugin("fixture.ok", { refs: [["fixture.ok", "panel:tray", "setting:volume", "service:shop.menu", "event:opened", "check:has-relation", "capability:files", "view"]] }));
  assert.deepEqual(report.findings.filter((f) => /^lesson|^no-lesson/.test(f.id)), []);
  assert.equal(report.blocking, 0);
});

test("a name the plugin no longer has is a warning that says what is missing, never a block; and the Panel is looked for in the interface file", () => {
  const dir = plugin("fixture.gone", { refs: [["panel:missing", "setting:gone", "service:nope", "event:nope", "check:nope", "capability:network", "bogus:thing", "other.plugin"]] });
  const findings = stale(dir);
  assert.equal(findings.length, 8);
  assert.ok(findings.every((f) => f.severity === "warn"));
  assert.ok(findings.some((f) => /the lesson names "panel:missing", the plugin no longer has it/.test(f.message)));
  assert.ok(findings.some((f) => /"bogus:thing".*does not know/.test(f.message)));
  assert.equal(scanPlugin(dir).blocking, 0);
  assert.equal(stale(plugin("fixture.panel", { refs: [["panel:tray"]] })).length, 0);
  assert.equal(stale(plugin("fixture.nopanel", { refs: [["panel:tray"]], ui: "export function activate() {}" })).length, 1);
});

test("a plugin without a lesson gets a warning, not a block", () => {
  const report = scanPlugin(plugin("fixture.none", { noLesson: true }));
  const f = report.findings.find((x) => x.id === "no-lesson");
  assert.ok(f);
  assert.equal(f.severity, "warn");
  assert.match(f.message, /Tutor cannot teach/);
  assert.equal(report.blocking, 0);
});

test("the warning also appears at load, in the plugin log", async () => {
  const store = mkdtempSync(join(scratch, "store"));
  cpSync(plugin("fixture.load", { refs: [["setting:gone"]] }), join(store, "fixture.load"), { recursive: true });
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
  try {
    assert.ok(core.plugins.logs().some((l: any) => l.plugin === "fixture.load" && /the lesson names "setting:gone"/.test(l.message)));
  } finally { await core.plugins.deactivate("fixture.load"); core.close(); }
});

test("an update that changes the plugin but not its lesson says so; changing the lesson too does not", () => {
  const installed = plugin("fixture.up", { version: "1.0.0" });
  const same = plugin("fixture.up", { version: "1.1.0", ui: `export function activate(ctx) { /* changed */ ctx.ui.slots.add("layout.panel", { id: "tray", title: "Tray", render() {} }); }` });
  const diff = difference(installed, scanPlugin(installed), scanPlugin(same), same);
  assert.equal(diff.lessonStale, true);
  const both = plugin("fixture.up", { version: "1.1.0", refs: [["fixture.up", "view"]], ui: `export function activate(ctx) { /* changed */ ctx.ui.slots.add("layout.panel", { id: "tray", title: "Tray", render() {} }); }` });
  assert.equal(difference(installed, scanPlugin(installed), scanPlugin(both), both).lessonStale, false);
  const onlyLesson = plugin("fixture.up", { version: "1.1.0", refs: [["fixture.up", "view"]] });
  assert.equal(difference(installed, scanPlugin(installed), scanPlugin(onlyLesson), onlyLesson).lessonStale, false);
});
