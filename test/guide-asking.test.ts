import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { GUIDE, guideClassMessage } from "../src/core/guide.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// roles-and-contract 02: the Tutor teaches how to ask a Builder well: the person writes the request first, the Tutor reads it and names what is missing; it never writes or sends it.
const scratch = mkdtempSync(join(tmpdir(), "aidea-guide-asking-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }));

test("the guide has a part on asking the Builder well, right after the Builder, with the four things, the reference menu and the Contract", () => {
  const order = GUIDE.order;
  assert.equal(order[order.indexOf("builder") + 1], "asking");
  const part = GUIDE.elements.asking;
  for (const word of [/goal/i, /rests on/i, /limits/i, /how you will know/i, /Add a reference to the message/, /Contract/, /nothing else starts it/i]) assert.match(part.what, word);
  assert.match(part.tryIt, /Send/);
});

test("the opening message of the guide class makes the person write first and forbids writing or sending the request for them", () => {
  const message = guideClassMessage();
  assert.match(message, /"asking"/);
  assert.match(message, /the person writes first/i);
  assert.match(message, /say which of the four things is missing/i);
  assert.match(message, /never write the request for them and never offer to send it/i);
});

test("in the guide class the Tutor receives the person's request as they wrote it, to read it and name what is missing", async () => {
  const seen: { answer?: any } = {};
  const adapter: Adapter = {
    options: { modes: [], models: [] },
    run: async function* (opts): AsyncGenerator<AgentEvent> {
      if (opts.role === "grader") { yield { type: "result", structured: { correct: false, feedback: "The limits are there; the goal and how to know it is done are not." } } as AgentEvent; return; }
      if (opts.role !== "tutor") return;
      const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
      const call = async (name: string, args: unknown) => JSON.parse((await (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }) })).json()).result.content[0].text);
      await call("begin_step", { stepId: "a1", title: "Asking the Builder well" });
      await call("predict", { stepId: "a1", prompt: "What makes a request good?" });
      await call("explain", { stepId: "a1", text: "A request has a goal, what it rests on, limits and how you will know." });
      seen.answer = await call("ask", { stepId: "a1", kind: "text", prompt: "Write the request you would send to the builder.", expected: "A request with the four things." });
      yield { type: "text", text: "ok" };
    },
  };
  const dir = mkdtempSync(join(scratch, "c"));
  const core = await startCore({ port: 0, adapter, learnerDir: dir, preferencesFile: join(dir, "p.json"), recentsFile: join(dir, "r.json") });
  try {
    const project = fixture("shop");
    const post = (path: string, b: unknown = {}) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    await post("/projects", { path: project });
    const res = await post("/tutor/classes", { project, guide: true });
    let buf = "";
    for await (const chunk of res.body as any) {
      buf += Buffer.from(chunk).toString();
      const lines = buf.split("\n");
      buf = lines.pop()!;
      for (const line of lines) {
        if (!line) continue;
        const e = JSON.parse(line);
        if (e.type === "tutor_question") await post("/tutor/answer", { id: e.id, secret: e.secret, ...(e.kind === "text" ? { text: "Add a cart. Only in the orders folder." } : { text: "a guess" }) });
      }
    }
    assert.match(seen.answer.answer, /Only in the orders folder/);
  } finally { core.close(); }
});

test("the guide has a part on asking for a plugin: the guide and template, the lesson, the surface, proposed never installed, the scan under Plugins", () => {
  const order = GUIDE.order;
  assert.equal(order[order.indexOf("asking") + 1], "plugin");
  const part = GUIDE.elements.plugin;
  for (const word of [/plugin guide/i, /template/i, /lesson/i, /teaching surface/i, /never installs/i, /"Plugins"/]) assert.match(part.what, word);
  assert.match(guideClassMessage(), /For the part "plugin"/);
});

test("a Builder that follows such a request (the template, a lesson and a surface) writes a plugin that is proposed, passes the scan and installs", async () => {
  const { cpSync, readFileSync, writeFileSync } = await import("node:fs");
  const { dirname } = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const template = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "plugin-template");
  const project = join(scratch, "project-plugin");
  cpSync(fixture("shop"), project, { recursive: true });
  const folder = join(project, "todo-panel");
  cpSync(template, folder, { recursive: true });
  const manifestFile = join(folder, "aidea-plugin.json");
  writeFileSync(manifestFile, readFileSync(manifestFile, "utf8").replace('"my-plugin"', '"todo-panel"')); // the only change a Builder must make to the template
  const results: { isError: boolean; text: string }[] = [];
  const adapter: Adapter = {
    options: { modes: [], models: [] },
    run: async function* ({ permission }): AsyncGenerator<AgentEvent> {
      const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
      const rpc = (method: string, params: unknown, id: number) => fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
      await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } }, 1);
      const r = (await (await rpc("tools/call", { name: "propose_plugin", arguments: { path: "todo-panel" } }, 2)).json()).result;
      results.push({ isError: r.isError === true, text: r.content[0].text });
      yield { type: "text", text: "ok" };
    },
  };
  const dir = mkdtempSync(join(scratch, "c"));
  const store = join(dir, "plugins");
  const core = await startCore({ port: 0, adapter, learnerDir: dir, pluginsDir: store, builtinPluginsDir: false, preferencesFile: join(dir, "p.json"), recentsFile: join(dir, "r.json") });
  try {
    const post = (path: string, b: unknown = {}) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
    await post("/projects", { path: project });
    await (await post("/chat", { project, message: "Write me a plugin that lists my to-do comments." })).text();
    assert.equal(results[0].isError, false, results[0].text);
    const entry = core.quarantine.list()[0];
    assert.equal(entry.report.blocking, 0);
    const installed = await (await post("/plugins/install", { id: entry.id })).json() as any;
    assert.equal(installed.status, "applied", JSON.stringify(installed));
    assert.equal(core.plugins.entry("todo-panel")?.state, "active");
  } finally { await core.plugins.deactivate("todo-panel"); core.close(); }
});
