import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// A stand-in for Claude Code: it asks aidea's permission tool the way Claude Code does, over MCP, and reports the answer.
const seen: { url?: string; answers: string[] } = { answers: [] };
const asClaude: Adapter = {
  run: async function* ({ permission }): AsyncGenerator<AgentEvent> {
    const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
    seen.url = url;
    const rpc = (method: string, params: unknown, id?: number) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      });
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } }, 1);
    await rpc("notifications/initialized", {});
    const call = await (await rpc("tools/call", { name: "approve", arguments: { tool_name: "Bash", input: { command: "echo hi" }, tool_use_id: "toolu_1" } }, 3)).json();
    const text = call.result.content[0].text as string;
    seen.answers.push(text);
    yield { type: "text", text };
  },
};

let core: Awaited<ReturnType<typeof startCore>>;
const project = fixture("shop");
before(async () => {
  core = await startCore({ port: 0, adapter: asClaude });
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
});
after(() => core.close());

const post = (path: string, body: unknown) =>
  fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// Reads the chat stream one event at a time, so a test can act while the builder is still waiting.
async function* events(res: Response): AsyncGenerator<Record<string, unknown>> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines) if (line) yield JSON.parse(line);
  }
}

const startChat = async () => {
  const res = await post("/chat", { project, message: "run a command" });
  const stream = events(res);
  const first = (await stream.next()).value!;
  return { stream, card: first };
};

test("a permission request from the builder reaches the interface as a pending card", async () => {
  const { stream, card } = await startChat();
  assert.equal(card.type, "permission");
  assert.equal(card.tool, "Bash");
  assert.deepEqual(card.input, { command: "echo hi" });
  assert.match(card.id as string, /^perm-/);
  await post("/permission", { id: card.id, decision: "allow" });
  for await (const _ of stream); // let the run finish
});

test("approving lets the action run: the builder is told to go ahead with the same input", async () => {
  const { stream, card } = await startChat();
  assert.equal((await post("/permission", { id: card.id, decision: "allow" })).status, 200);
  const answer = (await stream.next()).value!;
  assert.deepEqual(JSON.parse(answer.text as string), { behavior: "allow", updatedInput: { command: "echo hi" } });
  for await (const _ of stream);
});

test("rejecting denies the action and the builder is told why", async () => {
  const { stream, card } = await startChat();
  await post("/permission", { id: card.id, decision: "deny", message: "Not now" });
  const answer = (await stream.next()).value!;
  assert.deepEqual(JSON.parse(answer.text as string), { behavior: "deny", message: "Not now" });
  for await (const _ of stream);

  const second = await startChat();
  await post("/permission", { id: second.card.id, decision: "deny" });
  const plain = (await second.stream.next()).value!;
  assert.deepEqual(JSON.parse(plain.text as string), { behavior: "deny", message: "The person rejected this action" });
  for await (const _ of second.stream);
});

test("an answer is only accepted once, for a known request, with a valid decision", async () => {
  const { stream, card } = await startChat();
  assert.equal((await post("/permission", { id: card.id, decision: "maybe" })).status, 400);
  assert.equal((await post("/permission", { decision: "allow" })).status, 400);
  assert.equal((await post("/permission", { id: "perm-none", decision: "allow" })).status, 404);
  assert.equal((await post("/permission", { id: card.id, decision: "allow" })).status, 200);
  assert.equal((await post("/permission", { id: card.id, decision: "deny" })).status, 404);
  for await (const _ of stream);
});

test("the permission tool is only reachable with the token of a running conversation", async () => {
  const { stream, card } = await startChat();
  const url = seen.url!;
  const rpc = (target: string, method: string, id = 9) =>
    fetch(target, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params: {} }) });

  const listed = await (await rpc(url, "tools/list")).json();
  assert.equal(listed.result.tools[0].name, "approve");
  assert.deepEqual(listed.result.tools[0].inputSchema.required, ["tool_name", "input"]);
  const initialized = await (await rpc(url, "initialize")).json();
  assert.equal(initialized.result.serverInfo.name, "aidea");
  assert.equal((await (await rpc(url, "nope")).json()).error.code, -32601);

  assert.equal((await rpc(url.replace(/[0-9a-f]{32}$/, "0".repeat(32)), "tools/list")).status, 404);
  assert.equal((await fetch(url)).status, 405);

  await post("/permission", { id: card.id, decision: "allow" });
  for await (const _ of stream);
  // The conversation is over, so its token no longer works.
  assert.equal((await rpc(url, "tools/list")).status, 404);
});

test("if the person leaves while a request is waiting, it is denied so the builder does not hang", async () => {
  seen.answers.length = 0;
  const abort = new AbortController();
  const res = await fetch(core.url + "/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project, message: "run a command" }),
    signal: abort.signal,
  });
  const stream = events(res);
  const card = (await stream.next()).value!;
  assert.equal(card.type, "permission");
  abort.abort();
  for (let i = 0; i < 40 && seen.answers.length === 0; i++) await new Promise((r) => setTimeout(r, 50));
  assert.equal(JSON.parse(seen.answers[0]).behavior, "deny");
});
