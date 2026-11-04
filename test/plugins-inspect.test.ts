import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startCore } from "../src/core/server.ts";
import { CAPABILITIES } from "../src/core/plugins/manifest.ts";

// Ticket plugin-system/14 (Creator Mode, first half): a read-only inspection of the running app, a template to copy, and the skill that tells an agent how to write a plugin.
const root = join(import.meta.dirname, "..");
const scratch = mkdtempSync(join(tmpdir(), "aidea-inspect-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

let n = 0;
async function start(plugins: Record<string, { manifest: object; main: string }> = {}) {
  const store = join(scratch, `store${n++}`);
  mkdirSync(store, { recursive: true });
  for (const [folder, p] of Object.entries(plugins)) {
    mkdirSync(join(store, folder), { recursive: true });
    writeFileSync(join(store, folder, "aidea-plugin.json"), JSON.stringify(p.manifest));
    writeFileSync(join(store, folder, "main.js"), p.main);
  }
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
  const post = async (path: string, body: unknown) => {
    const res = await fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    return { status: res.status, body: (await res.json()) as any };
  };
  return { core, store, post, inspect: async () => (await (await fetch(core.url + "/plugins/inspect")).json()) as any };
}
const base = (id: string, extra: object = {}) => ({ id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...extra });

test("the inspection lists the API version, the slots with the shape of their entries, the capabilities, the event modes and the style tokens", async () => {
  const t = await start();
  try {
    const i = await t.inspect();
    assert.equal(i.api, "0.1");
    const panel = i.slots.find((s: any) => s.name === "layout.panel");
    assert.equal(panel.kind, "list");
    for (const field of ["id", "title", "render", "side", "startsHidden", "min", "icon"]) assert.ok(field in panel.entry, field);
    assert.deepEqual(i.capabilities, [...CAPABILITIES]);
    assert.deepEqual(i.eventModes, ["announce", "ask"]);
    assert.ok(i.manifestFields.some((f: any) => f.name === "id" && f.required === true));
  } finally { t.core.close(); }
});

test("the style tokens it lists are the ones the page defines and the API document names", async () => {
  const t = await start();
  try {
    const { styleTokens } = await t.inspect();
    const page = readFileSync(join(root, "src", "ui", "index.html"), "utf8");
    const doc = readFileSync(join(root, "docs", "plugin-api.md"), "utf8");
    assert.ok(styleTokens.length >= 15);
    for (const token of styleTokens) {
      assert.ok(page.includes(`${token}:`), `${token} is defined in the page`);
      assert.ok(doc.includes(`\`${token}\``), `${token} is named in docs/plugin-api.md`);
    }
  } finally { t.core.close(); }
});

test("it shows what the active plugins registered: services, events, and what each requires, provides and declares", async () => {
  const t = await start({
    a: { manifest: base("fixture.a", { provides: ["fixture.a.svc"], capabilities: ["files"], events: { went: { mode: "announce", version: 1 } }, settings: { color: { type: "string", label: "Color", default: "red" } } }), main: `export function activate(ctx) { ctx.services.provide("fixture.a.svc", 1); }` },
  });
  try {
    const i = await t.inspect();
    assert.deepEqual(i.services, [{ key: "fixture.a.svc", owner: "fixture.a" }]);
    assert.deepEqual(i.events, [{ name: "fixture.a/went", owner: "fixture.a", mode: "announce", version: 1 }]);
    const p = i.plugins.find((x: any) => x.id === "fixture.a");
    assert.deepEqual([p.provides, p.capabilities], [["fixture.a.svc"], ["files"]]);
    assert.equal(p.settings.color.type, "string");
  } finally { t.core.close(); }
});

test("the inspection is read-only: asking again changes nothing, and it cannot be posted to", async () => {
  const t = await start();
  try {
    const before = JSON.stringify(await t.inspect());
    assert.equal(JSON.stringify(await t.inspect()), before);
    assert.equal((await t.post("/plugins/inspect", {})).status, 404);
  } finally { t.core.close(); }
});

test("the template, copied unchanged into the quarantine with its id changed, passes the scan and installs", async () => {
  const dir = join(scratch, `tpl${n++}`);
  cpSync(join(root, "docs", "plugin-template"), dir, { recursive: true });
  const m = JSON.parse(readFileSync(join(dir, "aidea-plugin.json"), "utf8"));
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ ...m, id: "fixture.from-template" }));
  const t = await start();
  try {
    const q = await t.post("/plugins/quarantine", { source: dir });
    assert.equal(q.status, 201);
    assert.deepEqual(q.body.report.findings.filter((f: any) => f.severity === "block"), [], JSON.stringify(q.body.report.findings));
    const installed = await t.post("/plugins/install", { id: q.body.id });
    assert.deepEqual([installed.status, installed.body.status], [200, "applied"]);
    const i = await t.inspect();
    assert.ok(i.plugins.some((p: any) => p.id === "fixture.from-template"));
  } finally { t.core.close(); }
});

test("the skill tells an agent to start small, inspect the live app, copy the template, check, and stop; and it is served", async () => {
  const t = await start();
  try {
    const res = await fetch(t.core.url + "/plugins/skill");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/markdown/);
    const text = await res.text();
    for (const must of [/start small/i, /\/plugins\/inspect/, /plugin-template/, /quarantine/i, /propose/i, /never install/i, /docs\/plugin-api\.md/]) assert.match(text, must);
    assert.ok(text.length < 8000, "short enough to read in one go");
  } finally { t.core.close(); }
});
