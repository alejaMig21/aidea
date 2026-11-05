import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { difference } from "../src/core/plugins/diff.ts";
import { scanPlugin } from "../src/core/plugins/scan.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// plugin-teaching 04: a plugin the Builder writes that has state of its own (a Panel, a service, an event) cannot be proposed without a valid teaching surface; one without state needs only its lesson;
// for every other plugin a missing or stale surface is a warning, never a block.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(join(tmpdir(), "aidea-surface-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }));

const rpcTo = (url: string) => (method: string, params: unknown, id?: number) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
const results: { path: string; isError: boolean; text: string }[] = [];
const asBuilder: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ permission, message }): AsyncGenerator<AgentEvent> {
    const rpc = rpcTo(JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string);
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } }, 1);
    results.length = 0;
    for (const path of message.split("\n")) {
      const r = (await (await rpc("tools/call", { name: "propose_plugin", arguments: { path } }, 4)).json()).result;
      results.push({ path, isError: r.isError === true, text: r.content[0].text });
    }
    yield { type: "text", text: "done" };
  },
};

const LESSON = JSON.stringify({ parts: [{ name: "The plugin", hint: "h", what: "w", question: "q?", example: "e", narration: "n", tryIt: "t", refs: [] }] });
const MODULE = `export const view = (s) => s;\nexport const checks = { "is-open": () => ({ ok: true }) };`;
const TEACH = { view: "state", module: "teach.mjs", checks: [{ name: "is-open", says: "The Panel is open." }] };
const PANEL = `export function activate(ui) { return ui.slots.add("layout.panel", { id: "tray", title: "Tray", render() {} }); }`;
let n = 0;
function plugin(base: string, id: string, o: { ui?: boolean; surface?: boolean | "stale" | "nomodule"; lesson?: boolean; extra?: Record<string, unknown> } = {}) {
  const dir = join(base, `d${n++}`, id);
  mkdirSync(dir, { recursive: true });
  const manifest: Record<string, unknown> = { id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...(o.ui ? { ui: "ui.js" } : {}), ...(o.lesson === false ? {} : { lesson: "lesson.json" }), ...(o.surface ? { teach: o.surface === "stale" ? { ...TEACH, checks: [{ name: "gone", says: "A check the module lost." }] } : TEACH } : {}), ...o.extra };
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify(manifest));
  writeFileSync(join(dir, "main.js"), "export function activate() {}");
  if (o.ui) writeFileSync(join(dir, "ui.js"), PANEL);
  if (o.lesson !== false) writeFileSync(join(dir, "lesson.json"), LESSON);
  if (o.surface && o.surface !== "nomodule") writeFileSync(join(dir, "teach.mjs"), MODULE);
  return dir;
}
async function start() {
  const project = join(scratch, `project${n++}`);
  cpSync(fixture("shop"), project, { recursive: true });
  const store = join(scratch, `store${n++}`);
  mkdirSync(store, { recursive: true });
  const core = await startCore({ port: 0, adapter: asBuilder, pluginsDir: store, builtinPluginsDir: false });
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  await post("/projects", { path: project });
  const propose = async (...dirs: string[]) => {
    for (const d of dirs) cpSync(d, join(project, dirname(d).split(/[\\/]/).pop() + "-" + d.split(/[\\/]/).pop()), { recursive: true });
    await (await post("/chat", { project, message: dirs.map((d) => dirname(d).split(/[\\/]/).pop() + "-" + d.split(/[\\/]/).pop()).join("\n") })).text();
    return results.slice();
  };
  return { core, propose, post };
}

test("a Builder-written plugin with a Panel and no valid surface is not proposed, in plain words; a theme with only a lesson is; a Panel with a valid surface is", async () => {
  const t = await start();
  try {
    const none = plugin(scratch, "builder.panel", { ui: true });
    const nomodule = plugin(scratch, "builder.nomodule", { ui: true, surface: "nomodule" });
    const stale = plugin(scratch, "builder.stale", { ui: true, surface: "stale" });
    const theme = plugin(scratch, "builder.theme");
    const good = plugin(scratch, "builder.good", { ui: true, surface: true });
    const [a, b, c, d, e] = await t.propose(none, nomodule, stale, theme, good);
    assert.equal(a.isError, true);
    assert.match(a.text, /teaching surface/i);
    assert.match(a.text, /Tutor/);
    assert.equal(b.isError, true);
    assert.match(b.text, /module/i);
    assert.equal(c.isError, true);
    assert.match(c.text, /"gone"/);
    assert.equal(d.isError, false, d.text);
    assert.equal(e.isError, false, e.text);
    assert.equal(t.core.quarantine.list().length, 2);
  } finally { t.core.close(); }
});

test("a service or an event also counts as state of its own", async () => {
  const t = await start();
  try {
    const svc = plugin(scratch, "builder.service", { extra: { provides: ["shop.menu"] } });
    const [r] = await t.propose(svc);
    assert.equal(r.isError, true);
    assert.match(r.text, /teaching surface/i);
  } finally { t.core.close(); }
});

test("a plugin from anywhere else without a surface enters the quarantine with a warning, never a block", async () => {
  const t = await start();
  try {
    const src = plugin(scratch, "third.party", { ui: true });
    const res = await t.post("/plugins/quarantine", { source: src });
    assert.equal(res.status, 201);
    const report = scanPlugin(src);
    assert.equal(report.blocking, 0);
    assert.ok(report.findings.some((f) => f.id === "no-surface" && f.severity === "warn"));
    const theme = scanPlugin(plugin(scratch, "third.theme"));
    assert.deepEqual(theme.findings.filter((f) => /surface/.test(f.id)), [], "a plugin with no state of its own owes no surface");
    const stale = scanPlugin(plugin(scratch, "third.stale", { ui: true, surface: "stale" }));
    assert.ok(stale.findings.some((f) => f.id === "surface-stale" && /"gone"/.test(f.message)));
  } finally { t.core.close(); }
});

test("the warning shows at load, and an update that changes the plugin but not its surface says so", async () => {
  const store = mkdtempSync(join(scratch, "load"));
  cpSync(plugin(scratch, "fixture.load", { ui: true, surface: "stale" }), join(store, "fixture.load"), { recursive: true });
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
  try {
    assert.ok(core.plugins.logs().some((l: any) => l.plugin === "fixture.load" && /"gone"/.test(l.message)));
  } finally { await core.plugins.deactivate("fixture.load"); core.close(); }
  const installed = plugin(scratch, "fixture.up", { ui: true, surface: true });
  const same = plugin(scratch, "fixture.up", { ui: true, surface: true, extra: { version: "1.1.0", description: "Changed." } });
  const diff = difference(installed, scanPlugin(installed), scanPlugin(same), same);
  assert.equal(diff.surfaceStale, true);
});

test("the template, copied unchanged, carries a surface and passes the scan with no blocking finding and no surface warning", () => {
  const report = scanPlugin(join(root, "docs", "plugin-template"));
  assert.equal(report.blocking, 0);
  assert.deepEqual(report.findings.filter((f) => /surface|lesson/.test(f.id)), []);
});
