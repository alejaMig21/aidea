import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { readFileSync } from "node:fs";
import { startCore } from "../src/core/server.ts";
import { createClaudeAdapter } from "../src/core/adapter/claude.ts";
import { fixture } from "./helpers.ts";

// The fake process source: replays a recorded stream-json file through the real adapter's parser.
type Call = { args: string[]; cwd: string; stdin: string };
const calls: Call[] = [];
let script: { file?: string; spawnError?: string; exitCode?: number; stderr?: string } = {};

function fakeSpawn(args: string[], cwd: string) {
  const child = new EventEmitter() as any;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  const stdin = new PassThrough();
  child.stdin = stdin;
  child.kill = () => {};
  const call: Call = { args, cwd, stdin: "" };
  calls.push(call);
  stdin.on("data", (d) => (call.stdin += d));
  setImmediate(() => {
    if (script.spawnError) {
      child.emit("error", Object.assign(new Error("spawn claude ENOENT"), { code: script.spawnError }));
      return;
    }
    if (script.file) child.stdout.write(readFileSync(fixture(`streams/${script.file}`)));
    child.stdout.end();
    child.stderr.end(script.stderr ?? "");
    child.emit("close", script.exitCode ?? 0);
  });
  return child;
}

let core: Awaited<ReturnType<typeof startCore>>;
before(async () => {
  core = await startCore({ port: 0, adapter: createClaudeAdapter(fakeSpawn) });
  const res = await post("/projects", { path: fixture("shop") });
  assert.equal(res.status, 201);
});
after(() => core.close());

const post = (path: string, body: unknown) =>
  fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

// Sends a chat message and returns the streamed events.
async function chat(body: unknown, file?: string, extra: typeof script = {}) {
  script = { file, ...extra };
  calls.length = 0;
  const res = await post("/chat", body);
  const text = await res.text();
  const events = res.headers.get("content-type")?.includes("ndjson")
    ? text.split("\n").filter(Boolean).map((l) => JSON.parse(l))
    : [];
  return { res, text, events };
}

const shop = fixture("shop");

test("a message produces streamed reply events in order", async () => {
  const { res, events } = await chat({ project: shop, message: "Reply with the single word ok" }, "real-ok.jsonl");
  assert.equal(res.status, 200);
  assert.deepEqual(events, [
    { type: "session", sessionId: "session-0001" },
    { type: "text", text: "ok" },
    { type: "result", text: "ok", costUsd: 0.1194622, durationMs: 7026, usage: { inputTokens: 2, outputTokens: 4 } },
  ]);
});

test("tool calls are reported and sub-agent activity is nested under the call that started it", async () => {
  // Hand-written fixture following the documented stream-json shape: a real sub-agent run is costly to record.
  const { events } = await chat({ project: shop, message: "Find usages of total" }, "handwritten-subagent.jsonl");
  assert.deepEqual(events, [
    { type: "session", sessionId: "session-0003" },
    { type: "text", text: "Let me delegate the search." },
    { type: "tool", id: "toolu_task1", name: "Task", input: { description: "Find usages", subagent_type: "Explore", prompt: "Find usages of total" } },
    { type: "text", text: "Searching the repo.", parent: "toolu_task1" },
    { type: "tool", id: "toolu_grep1", name: "Grep", input: { pattern: "total" }, parent: "toolu_task1" },
    { type: "text", text: "Found 2 usages." },
    { type: "result", text: "Found 2 usages.", costUsd: 0.5, durationMs: 1200, usage: { inputTokens: 10, outputTokens: 20 } },
  ]);
});

test("Claude Code is launched unmodified, in the Project folder, with the message on stdin and no shell", async () => {
  const message = "-p; rm -rf $(whoami) `id`";
  await chat({ project: shop, message }, "real-ok.jsonl");
  // Everything but the flags that route permission requests to aidea (checked in the next test) and the person's
  // mode choice (checked in agent-options.test.ts).
  const aideaFlags = ["--mcp-config", "--permission-prompt-tool", "--allowedTools", "--disallowedTools", "--permission-mode"];
  const withoutPermissionFlags = (args: string[]) => args.filter((a, i) => !aideaFlags.includes(a) && !aideaFlags.includes(args[i - 1]));
  assert.deepEqual(withoutPermissionFlags(calls[0].args), ["-p", "--output-format", "stream-json", "--verbose"]);
  assert.equal(calls[0].cwd, shop);
  assert.equal(calls[0].stdin, message);

  await chat({ project: shop, message: "next", sessionId: "session-0001" }, "real-ok.jsonl");
  assert.deepEqual(withoutPermissionFlags(calls[0].args), ["-p", "--output-format", "stream-json", "--verbose", "--resume", "session-0001"]);
});

test("permission requests are routed to aidea's own tool, whose address belongs to this conversation only", async () => {
  await chat({ project: shop, message: "one" }, "real-ok.jsonl");
  const args = calls[0].args;
  assert.equal(args[args.indexOf("--permission-prompt-tool") + 1], "mcp__aidea__approve");
  const config = JSON.parse(args[args.indexOf("--mcp-config") + 1]);
  assert.equal(config.mcpServers.aidea.type, "http");
  const url: string = config.mcpServers.aidea.url;
  assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/mcp\/[0-9a-f]{32}$/);
  assert.ok(!args.includes("--bare") && !args.includes("--strict-mcp-config")); // the person's own servers and login stay in use

  // aidea's own tools that only create Proposals need no permission card; nothing else is pre-approved.
  const allowed = args[args.indexOf("--allowedTools") + 1].split(",");
  // The authored files change only through Proposals: the builder's own file tools are denied there, card or no card.
  assert.deepEqual(args[args.indexOf("--disallowedTools") + 1].split(",").sort(), ["Edit(.aidea/**)", "MultiEdit(.aidea/**)", "Write(.aidea/**)"]);
  assert.deepEqual(allowed.sort(), ["mcp__aidea__list_proposals", "mcp__aidea__propose_add_node", "mcp__aidea__propose_remove_node", "mcp__aidea__propose_update_node"]);

  await chat({ project: shop, message: "two" }, "real-ok.jsonl");
  assert.notEqual(JSON.parse(calls[0].args[calls[0].args.indexOf("--mcp-config") + 1]).mcpServers.aidea.url, url);
});

test("a missing Claude Code installation is reported as its own error", async () => {
  const { events } = await chat({ project: shop, message: "hi" }, undefined, { spawnError: "ENOENT" });
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "error");
  assert.equal(events[0].code, "not_installed");
  assert.match(events[0].message, /not installed/i);
});

test("a run that is not signed in is reported as its own error, once", async () => {
  // real-signed-out.jsonl was recorded with an empty CLAUDE_CONFIG_DIR.
  const { events } = await chat({ project: shop, message: "hi" }, "real-signed-out.jsonl", { exitCode: 1 });
  assert.deepEqual(events.map((e) => e.type + ":" + (e.code ?? "")), ["session:", "error:not_signed_in"]);
  assert.match(events[1].message, /not signed in/i);
});

test("a run that fails for another reason reports what Claude Code said", async () => {
  const { events } = await chat({ project: shop, message: "hi" }, undefined, { exitCode: 2, stderr: "boom happened" });
  assert.equal(events.length, 1);
  assert.equal(events[0].code, "failed");
  assert.match(events[0].message, /boom happened/);
});

test("requests that are not valid are rejected before anything is launched", async () => {
  const bad: [unknown, RegExp][] = [
    [{ project: "/not/opened", message: "hi" }, /project/],
    [{ project: shop, message: "" }, /message/],
    [{ project: shop, message: "   " }, /message/],
    [{ project: shop, message: 42 }, /message/],
    [{ project: shop, message: "x".repeat(20_001) }, /message/],
    [{ project: shop, message: "hi", sessionId: "--dangerous" }, /sessionId/],
    [{ project: shop, message: "hi", sessionId: 7 }, /sessionId/],
  ];
  for (const [body, pattern] of bad) {
    const { res, text } = await chat(body, "real-ok.jsonl");
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 80));
    assert.match(JSON.parse(text).error, pattern);
    assert.equal(calls.length, 0);
  }
  const notJson = await fetch(core.url + "/chat", { method: "POST", body: "{nope" });
  assert.equal(notJson.status, 400);
});
