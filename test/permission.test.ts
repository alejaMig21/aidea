import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

type Rpc = (method: string, params: unknown, id?: number, signal?: AbortSignal) => Promise<Response>;
const rpcTo = (url: string): Rpc => (method, params, id, signal) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    signal,
  });
const approve = (input: unknown = { command: "echo hi" }) => ({ name: "approve", arguments: { tool_name: "Bash", input, tool_use_id: "toolu_1" } });

// A stand-in for Claude Code: it asks aidea's permission tool the way Claude Code does, over MCP, and reports the answer.
const seen: { url?: string; answers: string[]; waiting?: Promise<void>; onAnswer?: () => void } = { answers: [] };
let behaviour: "ask" | "ask-then-fail" | "give-up" = "ask";
const asClaude: Adapter = {
  run: async function* ({ permission }): AsyncGenerator<AgentEvent> {
    const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
    seen.url = url;
    const rpc = rpcTo(url);
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } }, 1);
    await rpc("notifications/initialized", {});
    if (behaviour === "give-up") {
      // Claude Code stops waiting for an answer after a while: it drops the request.
      const patience = new AbortController();
      setTimeout(() => patience.abort(), 300);
      await rpc("tools/call", approve(), 3, patience.signal).catch(() => {});
      await new Promise((r) => setTimeout(r, 300)); // keep the conversation open so the interface can hear about it
      yield { type: "text", text: "gave up waiting" };
      return;
    }
    const answered = (async () => {
      const call = await (await rpc("tools/call", approve(), 3)).json();
      const text = call.result.content[0].text as string;
      seen.answers.push(text);
      seen.onAnswer?.();
      return text;
    })();
    if (behaviour === "ask-then-fail") {
      await new Promise((r) => setTimeout(r, 300)); // let the request reach aidea and show its card first
      throw new Error("the builder crashed"); // the request is still waiting
    }
    yield { type: "text", text: await answered };
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
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop()!;
      for (const line of lines) if (line) yield JSON.parse(line);
    }
  } finally {
    await reader.cancel().catch(() => {}); // leaving early closes the connection, like the person closing the page
  }
}

const startChat = async () => {
  const res = await post("/chat", { project, message: "run a command" });
  const stream = events(res);
  const card = (await stream.next()).value! as { id: string; secret: string; tool: string; input: unknown; type: string };
  return { stream, card };
};
const answer = (card: { id: string; secret: string }, decision: string, message?: string) =>
  post("/permission", { id: card.id, secret: card.secret, decision, message });

test("a permission request from the builder reaches the interface as a pending card", async () => {
  const { stream, card } = await startChat();
  assert.equal(card.type, "permission");
  assert.equal(card.tool, "Bash");
  assert.deepEqual(card.input, { command: "echo hi" });
  assert.match(card.id, /^perm-/);
  await answer(card, "allow");
  for await (const _ of stream); // let the run finish
});

test("approving lets the action run: the builder is told to go ahead with the same input", async () => {
  const { stream, card } = await startChat();
  assert.equal((await answer(card, "allow")).status, 200);
  const reply = (await stream.next()).value!;
  assert.deepEqual(JSON.parse(reply.text as string), { behavior: "allow", updatedInput: { command: "echo hi" } });
  for await (const _ of stream);
});

test("rejecting denies the action and the builder is told why", async () => {
  const { stream, card } = await startChat();
  await answer(card, "deny", "Not now");
  const reply = (await stream.next()).value!;
  // The reason is worded as the person's own, because Claude Code treats a bare text in a tool result as untrusted.
  assert.deepEqual(JSON.parse(reply.text as string), { behavior: "deny", message: 'The person rejected this action and wrote: "Not now"' });
  for await (const _ of stream);

  const second = await startChat();
  await answer(second.card, "deny");
  const plain = (await second.stream.next()).value!;
  assert.deepEqual(JSON.parse(plain.text as string), { behavior: "deny", message: "The person rejected this action" });
  for await (const _ of second.stream);
});

test("only the interface that holds the conversation's secret can answer; nobody else, not even the builder", async () => {
  const { stream, card } = await startChat();
  // The builder knows the port and its own tool address, but the secret only travels in the stream to the interface.
  assert.equal((await post("/permission", { id: card.id, decision: "allow" })).status, 400);
  assert.equal((await post("/permission", { id: card.id, secret: "0".repeat(card.secret.length), decision: "allow" })).status, 403);
  assert.equal((await post("/permission", { id: card.id, secret: 42, decision: "allow" })).status, 400);
  assert.equal((await answer(card, "allow")).status, 200);
  for await (const _ of stream);
});

test("an answer is only accepted once, for a known request, with a valid decision", async () => {
  const { stream, card } = await startChat();
  assert.equal((await answer(card, "maybe")).status, 400);
  assert.equal((await post("/permission", { secret: card.secret, decision: "allow" })).status, 400);
  assert.equal((await post("/permission", { id: "perm-none", secret: card.secret, decision: "allow" })).status, 404);
  assert.equal((await answer(card, "allow")).status, 200);
  assert.equal((await answer(card, "deny")).status, 404);
  for await (const _ of stream);
});

test("the permission tool is only reachable with the token of a running conversation", async () => {
  const { stream, card } = await startChat();
  const url = seen.url!;
  const rpc = rpcTo(url);
  const listed = await (await rpc("tools/list", {}, 9)).json();
  assert.equal(listed.result.tools[0].name, "approve");
  assert.deepEqual(listed.result.tools[0].inputSchema.required, ["tool_name", "input"]);
  const initialized = await (await rpc("initialize", {}, 9)).json();
  assert.equal(initialized.result.serverInfo.name, "aidea");
  assert.equal((await (await rpc("nope", {}, 9)).json()).error.code, -32601);

  assert.equal((await rpcTo(url.replace(/[0-9a-f]{32}$/, "0".repeat(32)))("tools/list", {}, 9)).status, 404);
  assert.equal((await fetch(url)).status, 405);

  await answer(card, "allow");
  for await (const _ of stream);
  assert.equal((await rpc("tools/list", {}, 9)).status, 404); // the conversation is over, so its token no longer works
});

test("a request whose input is not an object is refused, never turned into an empty approval", async () => {
  const { stream, card } = await startChat();
  const reply = await (await rpcTo(seen.url!)("tools/call", approve("rm -rf /"), 5)).json();
  assert.equal(reply.error.code, -32602);
  assert.equal(reply.result, undefined);
  await answer(card, "deny");
  for await (const _ of stream);
});

test("too many requests waiting at once are denied instead of piling up", async () => {
  const { stream, card } = await startChat(); // one request is waiting already
  const rpc = rpcTo(seen.url!);
  const waiting = Array.from({ length: 19 }, (_, i) => rpc("tools/call", approve({ command: `echo ${i}` }), 10 + i));
  await new Promise((r) => setTimeout(r, 300)); // let them register
  const extra = await (await rpc("tools/call", approve({ command: "one too many" }), 99)).json();
  assert.equal(JSON.parse(extra.result.content[0].text).behavior, "deny");
  assert.match(JSON.parse(extra.result.content[0].text).message, /too many/i);
  // Leaving ends the conversation, which denies everything that was still waiting.
  await stream.return(undefined);
  const settled = await Promise.all(waiting.map(async (p) => JSON.parse((await (await p).json()).result.content[0].text).behavior));
  assert.ok(settled.every((b) => b === "deny"));
  void card;
});

test("if the person leaves while a request is waiting, it is denied so the builder does not hang", async () => {
  seen.answers.length = 0;
  const denied = new Promise<void>((resolve) => (seen.onAnswer = resolve));
  const abort = new AbortController();
  const res = await fetch(core.url + "/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project, message: "run a command" }),
    signal: abort.signal,
  });
  const card = (await events(res).next()).value!;
  assert.equal(card.type, "permission");
  abort.abort();
  await denied;
  assert.equal(JSON.parse(seen.answers[0]).behavior, "deny");
});

test("if the builder fails while a request is waiting, the request is denied and the card goes away", async () => {
  seen.answers.length = 0;
  const denied = new Promise<void>((resolve) => (seen.onAnswer = resolve));
  behaviour = "ask-then-fail";
  try {
    const { stream, card } = await startChat();
    assert.equal(card.type, "permission");
    const next = (await stream.next()).value!; // the failure arrives as an event
    assert.equal(next.type, "error");
    await denied;
    assert.equal(JSON.parse(seen.answers[0]).behavior, "deny");
    assert.equal((await answer(card, "allow")).status, 404); // nothing left to answer
  } finally {
    behaviour = "ask";
  }
});

test("when the builder stops waiting, the card expires instead of staying answerable", async () => {
  behaviour = "give-up";
  try {
    const { stream, card } = await startChat();
    assert.equal(card.type, "permission");
    const next = (await stream.next()).value!;
    assert.deepEqual(next, { type: "permission_expired", id: card.id });
    assert.equal((await answer(card, "allow")).status, 404); // nobody is waiting for that answer any more
    for await (const _ of stream);
  } finally {
    behaviour = "ask";
  }
});

test("neither the permission tool nor the answers can be reached from another origin or another host", async () => {
  const { stream, card } = await startChat();
  const foreign = (url: string, headers: Record<string, string>, body: unknown) =>
    fetch(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
  assert.equal((await foreign(seen.url!, { origin: "http://evil.example" }, { jsonrpc: "2.0", id: 1, method: "tools/list" })).status, 403);
  assert.equal((await foreign(core.url + "/permission", { origin: "http://evil.example" }, { id: card.id, secret: card.secret, decision: "allow" })).status, 403);
  assert.equal((await answer(card, "allow")).status, 200); // still pending until the real interface answered
  for await (const _ of stream);
});
