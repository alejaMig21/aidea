import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { createClaudeAdapter } from "../src/core/adapter/claude.ts";
import { fixture } from "./helpers.ts";

type RunOptions = Parameters<Adapter["run"]>[0];
type Call = (name: string, args: unknown, signal?: AbortSignal) => Promise<{ content: { text: string }[]; isError?: boolean }>;
type Ctx = { opts: RunOptions; call: Call; url: string; rpc: (method: string, id?: number) => Promise<any> };

// A stand-in for the Tutor's Claude Code: the test scripts what it does with the core's Tutor tools, over MCP.
let tutorScript: (ctx: Ctx) => AsyncGenerator<AgentEvent> = async function* () {};
const launches: RunOptions[] = [];
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "sonnet", label: "Sonnet" }, { id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    launches.push(opts);
    if (opts.role !== "tutor") {
      yield { type: "text", text: "builder here" };
      return;
    }
    const url = JSON.parse(opts.tools!.mcpConfig).mcpServers.tutor.url as string;
    const rpc = (method: string, id = 1, params: unknown = {}, signal?: AbortSignal) =>
      fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }), signal }).then((r) => r.json());
    const call: Call = async (name, args, signal) => (await rpc("tools/call", 2, { name, arguments: args }, signal)).result;
    yield* tutorScript({ opts, call, url, rpc: (m, id) => rpc(m, id) });
  },
};

let core: Awaited<ReturnType<typeof startCore>>;
const project = fixture("shop");
before(async () => {
  core = await startCore({ port: 0, adapter: fakeAgent });
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
});
after(() => core.close());

const post = (path: string, body: unknown, signal?: AbortSignal) =>
  fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal });

async function* events(res: Response): AsyncGenerator<Record<string, any>> {
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
    await reader.cancel().catch(() => {});
  }
}

const startClass = async (body: Record<string, unknown> = {}) => {
  const res = await post("/tutor/classes", { project, ...body });
  return { res, stream: events(res) };
};
const answer = (q: { id: string; secret: string }, rest: Record<string, unknown>) => post("/tutor/answer", { id: q.id, secret: q.secret, ...rest });
const drain = async (stream: AsyncGenerator<Record<string, any>>) => { for await (const _ of stream); };

const choice = { kind: "choice", prompt: "Which one stores the data?", options: ["Queue", "Database", "Cache"], correct: "Database" };

// Runs one question through the Tutor and returns what the Tutor's tool call got back.
async function askAndAnswer(args: unknown, reply: Record<string, unknown>) {
  let result: any;
  tutorScript = async function* ({ call }) {
    result = await call("ask", args);
    yield { type: "text", text: "done" };
  };
  const { stream } = await startClass();
  const q = (await stream.next()).value!;
  await answer(q as any, reply);
  await drain(stream);
  return { q, result: JSON.parse(result.content[0].text) };
}

test("starting a class launches the Tutor role with its own instructions, its own tools and the stored Tutor model", async () => {
  await post("/agent-options", { project, model: "sonnet", tutorModel: "haiku" });
  launches.length = 0;
  tutorScript = async function* () { yield { type: "text", text: "Welcome to the class" }; };
  const { res, stream } = await startClass();
  assert.equal(res.status, 200);
  assert.deepEqual((await stream.next()).value, { type: "text", text: "Welcome to the class" });
  await drain(stream);
  const opts = launches[0];
  assert.equal(opts.role, "tutor");
  assert.equal(opts.model, "haiku");
  assert.match(opts.instructions!, /Tutor of aidea/);
  assert.match(opts.instructions!, /ask tool/i);
  assert.deepEqual(opts.tools!.allowedTools, ["mcp__tutor__*"]);
  assert.equal(opts.permission, undefined);
});

test("a class needs an open Project", async () => {
  assert.equal((await post("/tutor/classes", { project: "nope" })).status, 400);
  assert.equal((await post("/tutor/classes", {})).status, 400);
});

test("the Tutor's tool set is separate from the builder's", async () => {
  let tools: string[] = [];
  tutorScript = async function* ({ rpc }) {
    tools = (await rpc("tools/list")).result.tools.map((t: any) => t.name);
    yield { type: "text", text: "listed" };
  };
  const { stream } = await startClass();
  await drain(stream);
  assert.deepEqual(tools, ["ask"]);
});

test("a multiple-choice question reaches the interface without its correct answer, and the answer goes back to the waiting tool", async () => {
  const { q, result } = await askAndAnswer(choice, { option: 1, confidence: 70, thought: "It is the one that persists" });
  assert.equal(q.type, "tutor_question");
  assert.equal(q.kind, "choice");
  assert.equal(q.prompt, choice.prompt);
  assert.deepEqual(q.options, choice.options);
  assert.equal(q.allowDontKnow, true);
  assert.match(q.id, /^q-/);
  assert.ok(!JSON.stringify(q).includes("correct"), "the committed answer stays on the server");
  assert.deepEqual(result, { kind: "choice", answer: "Database", correct: true, correctAnswer: "Database", confidence: 70, thought: "It is the one that persists" });
});

test("a wrong choice is reported as wrong, and confidence defaults to 50", async () => {
  const { result } = await askAndAnswer(choice, { option: 0 });
  assert.equal(result.correct, false);
  assert.equal(result.answer, "Queue");
  assert.equal(result.correctAnswer, "Database");
  assert.equal(result.confidence, 50);
  assert.equal(result.thought, undefined);
});

test('"I don\'t know" is a valid answer, with or without a thought', async () => {
  const { result } = await askAndAnswer(choice, { dontKnow: true, thought: "no idea" });
  assert.deepEqual(result, { kind: "choice", dontKnow: true, correct: false, correctAnswer: "Database", thought: "no idea" });
});

test("a question can forbid \"I don't know\"", async () => {
  tutorScript = async function* ({ call }) { await call("ask", { ...choice, allowDontKnow: false }); yield { type: "text", text: "x" }; };
  const { stream } = await startClass();
  const q = (await stream.next()).value!;
  assert.equal(q.allowDontKnow, false);
  assert.equal((await answer(q as any, { dontKnow: true })).status, 400);
  await answer(q as any, { option: 1 });
  await drain(stream);
});

test("a free-text question returns the person's words and their thought", async () => {
  const { q, result } = await askAndAnswer({ kind: "text", prompt: "Why a queue?", expected: "To absorb bursts" }, { text: "So work waits its turn", thought: "like a line" });
  assert.equal(q.kind, "text");
  assert.equal(q.options, undefined);
  assert.ok(!JSON.stringify(q).includes("absorb"));
  assert.deepEqual(result, { kind: "text", answer: "So work waits its turn", expected: "To absorb bursts", thought: "like a line" });
});

test("a question with missing or inconsistent parts is rejected with words the model can act on", async () => {
  const bad: [unknown, RegExp][] = [
    [{ ...choice, options: undefined }, /options/],
    [{ ...choice, options: ["Only one"] }, /at least 2/],
    [{ ...choice, correct: undefined }, /correct/],
    [{ ...choice, correct: "Message broker" }, /exactly one of the options.*Queue.*Database.*Cache/s],
    [{ ...choice, prompt: "" }, /prompt/],
    [{ kind: "essay", prompt: "x" }, /kind.*choice.*text/s],
    [{ kind: "text" }, /prompt/],
  ];
  const seen: any[] = [];
  tutorScript = async function* ({ call }) {
    for (const [args] of bad) seen.push(await call("ask", args));
    yield { type: "text", text: "tried" };
  };
  const { stream } = await startClass();
  const first = await stream.next();
  assert.equal(first.value!.type, "text"); // no question card was ever shown
  await drain(stream);
  bad.forEach(([, re], i) => {
    assert.equal(seen[i].isError, true);
    assert.match(seen[i].content[0].text, re);
  });
});

test("an answer is checked against the question: secret, shape, confidence stops, once", async () => {
  tutorScript = async function* ({ call }) { await call("ask", choice); yield { type: "text", text: "x" }; };
  const { stream } = await startClass();
  const q = (await stream.next()).value! as any;
  assert.equal((await post("/tutor/answer", { id: q.id, option: 1 })).status, 400);
  assert.equal((await post("/tutor/answer", { id: q.id, secret: "0".repeat(q.secret.length), option: 1 })).status, 403);
  assert.equal((await answer(q, { option: 7 })).status, 400);
  assert.equal((await answer(q, { option: 1, confidence: 42 })).status, 400);
  assert.equal((await answer(q, { text: "words" })).status, 400);
  assert.equal((await answer(q, {})).status, 400);
  assert.equal((await answer(q, { option: 1, confidence: 90 })).status, 200);
  assert.equal((await answer(q, { option: 1 })).status, 404);
  assert.equal((await post("/tutor/answer", { id: "q-none", secret: q.secret, option: 1 })).status, 404);
  await drain(stream);
});

test("a permission answer cannot settle a question, and the builder's tools are not the Tutor's", async () => {
  tutorScript = async function* ({ call }) {
    const r: any = await call("approve", { tool_name: "Bash", input: {} }).catch((e) => e);
    yield { type: "text", text: JSON.stringify(r) };
    await call("ask", choice);
  };
  const { stream } = await startClass();
  const text = (await stream.next()).value! as any;
  assert.equal(text.type, "text");
  const q = (await stream.next()).value! as any;
  assert.equal((await post("/permission", { id: q.id, secret: q.secret, decision: "allow" })).status, 404);
  await answer(q, { option: 1 });
  await drain(stream);
});

test("if the Tutor stops waiting, the question is withdrawn and cannot be answered", async () => {
  tutorScript = async function* ({ call }) {
    const patience = new AbortController();
    setTimeout(() => patience.abort(), 200);
    await call("ask", choice, patience.signal).catch(() => {});
    await new Promise((r) => setTimeout(r, 200));
    yield { type: "text", text: "gave up" };
  };
  const { stream } = await startClass();
  const q = (await stream.next()).value! as any;
  assert.equal(q.type, "tutor_question");
  assert.deepEqual((await stream.next()).value, { type: "tutor_question_expired", id: q.id });
  assert.equal((await answer(q, { option: 1 })).status, 404);
  await drain(stream);
});

test("ending the class while a question waits releases the Tutor and closes its tool address", async () => {
  let released: any;
  let url = "";
  const gone = new Promise<void>((resolve) => {
    tutorScript = async function* (ctx) {
      url = ctx.url;
      released = await ctx.call("ask", choice);
      resolve();
      yield { type: "text", text: "late" };
    };
  });
  const abort = new AbortController();
  const res = await post("/tutor/classes", { project }, abort.signal);
  const q = (await events(res).next()).value! as any;
  abort.abort();
  await gone;
  assert.equal(released.isError, true);
  assert.match(released.content[0].text, /class ended|withdrawn/i);
  assert.equal((await answer(q, { option: 1 })).status, 404);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal((await fetch(url, { method: "POST", body: "{}" })).status, 404);
});

test("the builder chat and a class run side by side", async () => {
  tutorScript = async function* ({ call }) { await call("ask", choice); yield { type: "text", text: "x" }; };
  const { stream } = await startClass();
  const q = (await stream.next()).value! as any; // the class is now waiting for the person
  const chat = await post("/chat", { project, message: "hello" });
  const chatEvents: Record<string, any>[] = [];
  for await (const e of events(chat)) chatEvents.push(e);
  assert.deepEqual(chatEvents, [{ type: "text", text: "builder here" }]);
  assert.equal((await answer(q, { option: 1 })).status, 200);
  await drain(stream);
});

test("when the agent cannot run, the class says so in plain words and nothing is left open", async () => {
  let url = "";
  tutorScript = async function* ({ url: u }) {
    url = u;
    yield { type: "error", code: "not_signed_in", message: "Claude Code is not signed in. Run `claude` in a terminal, use /login, then try again." };
  };
  const { stream } = await startClass();
  const all: Record<string, any>[] = [];
  for await (const e of stream) all.push(e);
  assert.deepEqual(all.map((e) => e.type), ["error"]);
  assert.match(all[0].message, /not signed in/);
  assert.equal((await fetch(url, { method: "POST", body: "{}" })).status, 404);
});

test("a Tutor that crashes is reported as an error event", async () => {
  tutorScript = async function* () { throw new Error("boom"); };
  const { stream } = await startClass();
  const all: Record<string, any>[] = [];
  for await (const e of stream) all.push(e);
  assert.deepEqual(all, [{ type: "error", code: "failed", message: "The Tutor stopped unexpectedly" }]);
});

// ---- The real launch recipe, asserted with a fake process.
function recordingSpawn(seen: { args: string[]; cwd: string }[], lines: string[] = []) {
  return (args: string[], cwd: string) => {
    seen.push({ args, cwd });
    const child = new EventEmitter() as any;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.kill = () => {};
    setImmediate(() => { child.stdout.end(lines.join("\n") + "\n"); child.stderr.end(); child.emit("close", 0); });
    return child;
  };
}

test("the Claude adapter launches the Tutor isolated: only the core's tools, no plugins, no instructions of the person's", async () => {
  const seen: { args: string[]; cwd: string }[] = [];
  const cfg = JSON.stringify({ mcpServers: { tutor: { type: "http", url: "http://x/mcp/t" } } });
  for await (const _ of createClaudeAdapter(recordingSpawn(seen)).run({
    cwd: "neutral", message: "hi", role: "tutor", model: "haiku", instructions: "TUTOR RULES", tools: { mcpConfig: cfg, allowedTools: ["mcp__tutor__*"] },
  })) { /* drain */ }
  const args = seen[0].args;
  const after = (flag: string) => args[args.indexOf(flag) + 1];
  assert.equal(seen[0].cwd, "neutral");
  assert.deepEqual(args.slice(0, 4), ["-p", "--output-format", "stream-json", "--verbose"]);
  assert.equal(after("--system-prompt"), "TUTOR RULES");
  assert.equal(after("--setting-sources"), "");
  assert.equal(after("--mcp-config"), cfg);
  assert.equal(after("--tools"), "");
  assert.equal(after("--allowedTools"), "mcp__tutor__*");
  assert.equal(after("--model"), "haiku");
  for (const flag of ["--strict-mcp-config", "--disable-slash-commands", "--no-session-persistence"]) assert.ok(args.includes(flag), flag);
  for (const flag of ["--append-system-prompt", "--resume", "--permission-mode", "--permission-prompt-tool", "--bare", "--dangerously-skip-permissions"]) assert.ok(!args.includes(flag), flag);
});

test("token counts include the cache tokens, where nearly all the input lives", async () => {
  const seen: { args: string[]; cwd: string }[] = [];
  const result = JSON.stringify({ type: "result", is_error: false, result: "ok", usage: { input_tokens: 2, cache_creation_input_tokens: 400, cache_read_input_tokens: 600, output_tokens: 9 } });
  const out: AgentEvent[] = [];
  for await (const e of createClaudeAdapter(recordingSpawn(seen, [result])).run({ cwd: ".", message: "hi" })) out.push(e);
  assert.deepEqual((out[0] as any).usage, { inputTokens: 1002, outputTokens: 9 });
});
