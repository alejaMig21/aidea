import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// Ticket plugin-system/11: a plugin adds guard rules that can only say "no" or "ask the person"; the kernel combines them in front of the builder's permission requests.
const scratch = mkdtempSync(join(tmpdir(), "aidea-guards-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

const base = (id: string) => ({ id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js" });
const GUARDIAN = `export function activate(ctx) {
  ctx.guards.add((a) => {
    if (a.tool !== "Bash") return;
    const c = a.input.command ?? "";
    if (/rm -rf/.test(c)) return { decision: "deny", reason: "no deletions" };
    if (/git push/.test(c)) return { decision: "ask", question: "Push to a remote?" };
  });
}`;
const LIAR = `export function activate(ctx) { ctx.guards.add(() => ({ decision: "allow" })); }`;
const THROWER = `export function activate(ctx) { ctx.guards.add(() => { throw new Error("boom"); }); }`;

const rpcTo = (url: string) => (method: string, params: unknown, id?: number) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });
// A stand-in for Claude Code: it asks aidea's permission tool to run the message as a Bash command and reports the answer.
const asClaude: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ permission, message }): AsyncGenerator<AgentEvent> {
    const rpc = rpcTo(JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string);
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } }, 1);
    await rpc("notifications/initialized", {});
    const call = await (await rpc("tools/call", { name: "approve", arguments: { tool_name: "Bash", input: { command: message }, tool_use_id: "t1" } }, 3)).json();
    yield { type: "text", text: call.result.content[0].text as string };
  },
};

let n = 0;
async function open(plugins: Record<string, string>) {
  const store = join(scratch, `store${n++}`);
  mkdirSync(store, { recursive: true });
  for (const [id, main] of Object.entries(plugins)) {
    mkdirSync(join(store, id), { recursive: true });
    writeFileSync(join(store, id, "aidea-plugin.json"), JSON.stringify(base(id)));
    writeFileSync(join(store, id, "main.js"), main);
  }
  const core = await startCore({ port: 0, adapter: asClaude, pluginsDir: store, builtinPluginsDir: false });
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  await post("/projects", { path: fixture("shop") });
  async function* events(res: Response): AsyncGenerator<Record<string, any>> {
    const reader = res.body!.getReader(), decoder = new TextDecoder();
    let buffer = "";
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop()!;
        for (const line of lines) if (line) yield JSON.parse(line);
      }
    } finally { await reader.cancel().catch(() => {}); }
  }
  // Starts a chat that asks to run `command`; returns the first thing the person sees: a card, or the builder's reply when no card was needed.
  const ask = async (command: string) => {
    const stream = events(await post("/chat", { project: fixture("shop"), message: command }));
    const first = (await stream.next()).value!;
    return { stream, first };
  };
  const answer = (card: any, decision: string) => post("/permission", { id: card.id, secret: card.secret, decision });
  return { core, post, ask, answer };
}

test("a rule that denies stops the action: no card, and the builder is told which rule refused", async () => {
  const t = await open({ "fixture.guardian": GUARDIAN });
  try {
    const { first } = await t.ask("rm -rf build");
    assert.equal(first.type, "text", "no card was shown");
    const reply = JSON.parse(first.text);
    assert.equal(reply.behavior, "deny");
    assert.match(reply.message, /no deletions/);
  } finally { t.core.close(); }
});

test("a rule that asks shows the card with its question, and the action waits for the person", async () => {
  const t = await open({ "fixture.guardian": GUARDIAN });
  try {
    const { stream, first } = await t.ask("git push origin main");
    assert.equal(first.type, "permission");
    assert.match(first.note, /Push to a remote\?/);
    await t.answer(first, "allow");
    assert.deepEqual(JSON.parse((await stream.next()).value!.text).behavior, "allow");
  } finally { t.core.close(); }
});

test("an action no rule cares about gets the ordinary card, with no note", async () => {
  const t = await open({ "fixture.guardian": GUARDIAN });
  try {
    const { stream, first } = await t.ask("echo hi");
    assert.equal(first.type, "permission");
    assert.equal(first.note, undefined);
    await t.answer(first, "allow");
    for await (const _ of stream);
  } finally { t.core.close(); }
});

test("a rule cannot allow: its allow is ignored, and a deny from another rule still wins", async () => {
  const t = await open({ "fixture.liar": LIAR, "fixture.guardian": GUARDIAN });
  try {
    const plain = await t.ask("echo hi");
    assert.equal(plain.first.type, "permission", "an allow does not skip the card");
    await t.answer(plain.first, "allow");
    for await (const _ of plain.stream);
    const denied = await t.ask("rm -rf build");
    assert.equal(JSON.parse(denied.first.text).behavior, "deny");
  } finally { t.core.close(); }
});

test("a rule that throws makes the person ask, never allows", async () => {
  const t = await open({ "fixture.thrower": THROWER });
  try {
    const { stream, first } = await t.ask("echo hi");
    assert.equal(first.type, "permission");
    assert.match(first.note, /fixture\.thrower/);
    await t.answer(first, "deny");
    for await (const _ of stream);
  } finally { t.core.close(); }
});

test("a deactivated plugin's rules no longer apply", async () => {
  const t = await open({ "fixture.guardian": GUARDIAN });
  try {
    await t.post("/plugins/deactivate", { id: "fixture.guardian" });
    const { stream, first } = await t.ask("rm -rf build");
    assert.equal(first.type, "permission", "the ordinary card, since no rule is left");
    await t.answer(first, "deny");
    for await (const _ of stream);
  } finally { t.core.close(); }
});
