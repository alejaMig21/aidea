import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// Ticket plugin-system/15 (Creator Mode, second half): the Builder writes a plugin into its workspace and PROPOSES it: it lands in the quarantine and the manager opens. The Builder cannot install.
const scratch = mkdtempSync(join(tmpdir(), "aidea-builder-plugin-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

const rpcTo = (url: string) => (method: string, params: unknown, id?: number) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });

// A stand-in for the Builder: it lists aidea's tools, reads the guide, and proposes the plugin folders named in the message (one per line).
const seen: { tools: string[]; guide: string; results: { path: string; isError: boolean; text: string }[] } = { tools: [], guide: "", results: [] };
const asBuilder: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ permission, message }): AsyncGenerator<AgentEvent> {
    const rpc = rpcTo(JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string);
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } }, 1);
    await rpc("notifications/initialized", {});
    seen.tools = (await (await rpc("tools/list", {}, 2)).json()).result.tools.map((t: any) => t.name);
    seen.guide = (await (await rpc("tools/call", { name: "read_plugin_guide", arguments: {} }, 3)).json()).result.content[0].text;
    seen.results = [];
    for (const path of message.split("\n")) {
      const r = (await (await rpc("tools/call", { name: "propose_plugin", arguments: { path } }, 4)).json()).result;
      seen.results.push({ path, isError: r.isError === true, text: r.content[0].text });
    }
    yield { type: "text", text: "done" };
  },
};

let n = 0;
async function start() {
  const project = join(scratch, `project${n++}`);
  cpSync(fixture("shop"), project, { recursive: true });
  const dir = (name: string, files: Record<string, string>) => { mkdirSync(join(project, name), { recursive: true }); for (const [f, t] of Object.entries(files)) writeFileSync(join(project, name, f), t); };
  const store = join(scratch, `store${n++}`);
  mkdirSync(store, { recursive: true });
  const core = await startCore({ port: 0, adapter: asBuilder, pluginsDir: store, builtinPluginsDir: false });
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  await post("/projects", { path: project });
  const chat = async (message: string) => {
    const res = await post("/chat", { project, message });
    const events: any[] = (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));
    return events;
  };
  return { core, project, dir, post, chat, store };
}
const manifest = (id: string) => JSON.stringify({ id, version: "1.0.0", title: `Title of ${id}`, description: "Written by the builder.", publisher: "builder", api: "0.1", main: "main.js" });

test("the Builder has a tool to propose a plugin and one to read the guide, and no tool that installs, enables, updates or removes one", async () => {
  const t = await start();
  try {
    await t.chat("nothing");
    assert.ok(seen.tools.includes("propose_plugin") && seen.tools.includes("read_plugin_guide"), seen.tools.join(", "));
    assert.deepEqual(seen.tools.filter((name) => /install|enable|disable|remove_plugin|update_plugin|uninstall/.test(name)), []);
    assert.match(seen.guide, /start small/i);
  } finally { t.core.close(); }
});

test("a proposed plugin lands in the quarantine, nothing runs or is installed, and the window is told to open the manager", async () => {
  const t = await start();
  try {
    t.dir("my-plugin", { "aidea-plugin.json": manifest("builder.made"), "main.js": `globalThis.__plugLog?.push("builder plugin ran"); export function activate() {}` });
    const events = await t.chat("my-plugin");
    assert.equal(seen.results[0].isError, false, seen.results[0].text);
    const proposed = events.find((e) => e.type === "plugin_proposed");
    assert.ok(proposed, JSON.stringify(events.map((e) => e.type)));
    assert.equal(proposed.title, "Title of builder.made");
    assert.match(seen.results[0].text, /person/i);
    const { entries } = (await (await fetch(t.core.url + "/plugins/quarantine")).json()) as any;
    assert.deepEqual(entries.map((e: any) => e.id), [proposed.id]);
    const { plugins } = (await (await fetch(t.core.url + "/plugins")).json()) as any;
    assert.deepEqual(plugins, [], "nothing was installed");
  } finally { t.core.close(); }
});

test("a path that leaves the Project, is absolute, is not a folder or does not exist is refused", async () => {
  const t = await start();
  try {
    t.dir("ok", { "aidea-plugin.json": manifest("builder.ok") });
    writeFileSync(join(t.project, "file.txt"), "x");
    const events = await t.chat(["../outside", scratch, "file.txt", "missing", "ok"].join("\n"));
    assert.deepEqual(seen.results.map((r) => r.isError), [true, true, true, true, false], JSON.stringify(seen.results));
    assert.equal(events.filter((e) => e.type === "plugin_proposed").length, 1, "only the valid one is proposed");
  } finally { t.core.close(); }
});

test("a plugin that is installed gets no way to install another: its context has no manager, installer or quarantine", async () => {
  const keys: string[] = [];
  (globalThis as any).__ctxKeys = keys;
  const store = join(scratch, `store${n++}`);
  mkdirSync(join(store, "p"), { recursive: true });
  writeFileSync(join(store, "p", "aidea-plugin.json"), JSON.stringify({ id: "fixture.p", version: "1.0.0", title: "P", description: "x", publisher: "t", api: "0.1", main: "main.js" }));
  writeFileSync(join(store, "p", "main.js"), `export function activate(ctx) { globalThis.__ctxKeys.push(...Object.keys(ctx), ...Object.keys(ctx.services), ...Object.keys(ctx.guards)); }`);
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
  try {
    assert.ok(keys.length > 0);
    assert.deepEqual(keys.filter((k) => /install|manager|quarantine|enable|remove|update/i.test(k)), []);
  } finally { core.close(); }
});
