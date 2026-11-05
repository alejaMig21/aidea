import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { readManifest } from "../src/core/plugins/manifest.ts";
import { scanPlugin } from "../src/core/plugins/scan.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// plugin-lessons 04: a plugin the Builder writes cannot be proposed without a valid lesson; the template carries one; the skill says to write it and keep it; a plugin from anywhere else is never refused for lacking one.
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const scratch = mkdtempSync(join(tmpdir(), "aidea-builder-lesson-"));
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

let n = 0;
async function start() {
  const project = join(scratch, `project${n++}`);
  cpSync(fixture("shop"), project, { recursive: true });
  const store = join(scratch, `store${n++}`);
  mkdirSync(store, { recursive: true });
  const core = await startCore({ port: 0, adapter: asBuilder, pluginsDir: store, builtinPluginsDir: false });
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  await post("/projects", { path: project });
  const dir = (name: string, files: Record<string, string>) => { mkdirSync(join(project, name), { recursive: true }); for (const [f, t] of Object.entries(files)) writeFileSync(join(project, name, f), t); };
  const propose = async (...paths: string[]) => { await (await post("/chat", { project, message: paths.join("\n") })).text(); return results.slice(); };
  return { core, dir, propose, post };
}
const manifest = (id: string, extra: Record<string, unknown> = {}) => JSON.stringify({ id, version: "1.0.0", title: `Title of ${id}`, description: "Written by the builder.", publisher: "builder", api: "0.1", main: "main.js", ...extra });
const LESSON = JSON.stringify({ parts: [{ name: "The plugin", hint: "What is it?", what: "It does one thing.", question: "What would you expect it to do?", example: "Press the button.", narration: "Let's look.", tryIt: "Open it.", refs: [] }] });

test("a Builder-written plugin without a lesson is not proposed, and the reason is in plain words; with a valid lesson it is", async () => {
  const t = await start();
  try {
    t.dir("none", { "aidea-plugin.json": manifest("builder.none"), "main.js": "export function activate() {}" });
    t.dir("bad", { "aidea-plugin.json": manifest("builder.bad", { lesson: "lesson.json" }), "main.js": "export function activate() {}", "lesson.json": JSON.stringify({ parts: [{ name: "x" }] }) });
    t.dir("good", { "aidea-plugin.json": manifest("builder.good", { lesson: "lesson.json" }), "main.js": "export function activate() {}", "lesson.json": LESSON });
    const [none, bad, good] = await t.propose("none", "bad", "good");
    assert.equal(none.isError, true);
    assert.match(none.text, /must come with a lesson/i);
    assert.match(none.text, /Tutor/);
    assert.equal(bad.isError, true);
    assert.match(bad.text, /lesson.*not valid/i);
    assert.match(bad.text, /"lesson"/);
    assert.equal(good.isError, false, good.text);
    assert.equal(t.core.quarantine.list().length, 1, "only the plugin with a lesson reached the quarantine");
  } finally { t.core.close(); }
});

test("a plugin from anywhere else is never refused for lacking a lesson: it enters the quarantine with a warning", async () => {
  const t = await start();
  try {
    const src = join(scratch, "third-party");
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, "aidea-plugin.json"), manifest("third.party"));
    writeFileSync(join(src, "main.js"), "export function activate() {}");
    const res = await t.post("/plugins/quarantine", { source: src });
    assert.equal(res.status, 201);
    const report = scanPlugin(src);
    assert.equal(report.blocking, 0);
    assert.ok(report.findings.some((f) => f.id === "no-lesson" && f.severity === "warn"));
  } finally { t.core.close(); }
});

test("the template carries a valid lesson, and copied unchanged it passes the scan with no blocking finding", () => {
  const template = join(root, "docs", "plugin-template");
  const read = readManifest(template);
  assert.ok("manifest" in read, JSON.stringify(read));
  assert.equal(read.manifest.lesson, "lesson.json");
  const report = scanPlugin(template);
  assert.equal(report.blocking, 0);
  assert.deepEqual(report.findings.filter((f) => /^lesson|^no-lesson/.test(f.id)), []);
});

test("the skill tells the agent to write the lesson with the plugin, keep it up to date, and what refs may name", () => {
  const skill = readFileSync(join(root, "docs", "plugin-skill.md"), "utf8");
  assert.match(skill, /lesson/i);
  assert.match(skill, /write the lesson/i);
  assert.match(skill, /every time the plugin changes/i);
  assert.match(skill, /refs/);
  assert.match(skill, /panel:<id>|setting:<key>/);
});
