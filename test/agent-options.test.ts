import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startCore } from "../src/core/server.ts";
import { createClaudeAdapter } from "../src/core/adapter/claude.ts";
import type { Adapter } from "../src/core/types.ts";
import { fixture } from "./helpers.ts";

const shop = fixture("shop");
const scratch = mkdtempSync(join(tmpdir(), "aidea-prefs-"));
const prefsFile = join(scratch, "store", "preferences.json");

// Claude Code adapter over a fake process source that records the arguments.
const calls: string[][] = [];
function fakeSpawn(args: string[]) {
  calls.push(args);
  const child = new EventEmitter() as any;
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = new PassThrough();
  child.kill = () => {};
  setImmediate(() => {
    child.stdout.write(readFileSync(fixture("streams/real-ok.jsonl")));
    child.stdout.end();
    child.stderr.end();
    child.emit("close", 0);
  });
  return child;
}

// A different agent product: its own modes and models, one mode unavailable.
const seen: { mode?: string; model?: string }[] = [];
const other: Adapter = {
  options: {
    modes: [
      { id: "ask", label: "Ask", meaning: "Asks before acting.", available: true },
      { id: "yolo", label: "Yolo", meaning: "Never asks.", available: false, reason: "Needs the Pro plan." },
    ],
    models: [{ id: "big", label: "Big" }, { id: "small", label: "Small" }],
  },
  async *run({ mode, model }) {
    seen.push({ mode, model });
    yield { type: "result", text: "ok", usage: {} };
  },
};

const start = async (adapter: Adapter) => {
  const core = await startCore({ port: 0, adapter, preferencesFile: prefsFile });
  const post = (path: string, body: unknown) =>
    fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  assert.equal((await post("/projects", { path: shop })).status, 201);
  const options = async () => (await fetch(core.url + "/agent-options?project=" + encodeURIComponent(shop))).json() as Promise<any>;
  const chat = async (message = "hi") => (await post("/chat", { project: shop, message })).text();
  return { core, post, options, chat };
};

let t: Awaited<ReturnType<typeof start>>;
before(async () => { t = await start(createClaudeAdapter(fakeSpawn)); });
after(() => t.core.close());

test("the Claude Code adapter declares its modes and models itself", async () => {
  const o = await t.options();
  assert.deepEqual(o.modes.map((m: any) => m.id), ["default", "acceptEdits", "plan", "auto"]);
  assert.deepEqual(o.modes.map((m: any) => m.label), ["Manual", "Accept edits", "Plan", "Auto"]);
  assert.ok(o.modes.every((m: any) => m.available === true && m.meaning));
  assert.match(o.modes[3].meaning, /plan|model|provider|version/i); // the availability caveat
  assert.deepEqual(o.models.map((m: any) => m.id), ["default", "sonnet", "opus", "haiku"]);
  assert.ok(!JSON.stringify(o).match(/dontAsk|bypassPermissions/));
});

test("the choice defaults to the first mode and the default model", async () => {
  assert.deepEqual((await t.options()).choice, { mode: "default", model: "default", tutorModel: "default" });
});

test("a choice the adapter does not offer is refused, a valid one is kept", async () => {
  for (const body of [{ mode: "bypassPermissions" }, { model: "gpt" }, { tutorModel: "nope" }, { mode: 3 }, {}]) {
    assert.equal((await t.post("/agent-options", { project: shop, ...body })).status, 400, JSON.stringify(body));
  }
  assert.equal((await t.post("/agent-options", { project: "nowhere", mode: "plan" })).status, 400);
  assert.equal((await t.post("/agent-options", { project: shop, mode: "plan", model: "sonnet", tutorModel: "haiku" })).status, 200);
  assert.deepEqual((await t.options()).choice, { mode: "plan", model: "sonnet", tutorModel: "haiku" });
});

test("the choice applies to the next message as flags; the default model sends no --model", async () => {
  await t.post("/agent-options", { project: shop, mode: "acceptEdits", model: "opus" });
  calls.length = 0;
  await t.chat();
  const a = calls[0];
  assert.equal(a[a.indexOf("--permission-mode") + 1], "acceptEdits");
  assert.equal(a[a.indexOf("--model") + 1], "opus");

  await t.post("/agent-options", { project: shop, model: "default" });
  calls.length = 0;
  await t.chat();
  assert.ok(calls[0].includes("--permission-mode") && !calls[0].includes("--model"));
});

test("the choice survives a core restart", async () => {
  await t.post("/agent-options", { project: shop, mode: "plan", model: "haiku", tutorModel: "opus" });
  t.core.close();
  t = await start(createClaudeAdapter(fakeSpawn));
  assert.deepEqual((await t.options()).choice, { mode: "plan", model: "haiku", tutorModel: "opus" });
});

test("another adapter shows its own modes and models, nothing from Claude Code", async () => {
  const o = await start(other);
  try {
    const got = await o.options();
    assert.deepEqual(got.modes.map((m: any) => m.id), ["ask", "yolo"]);
    assert.deepEqual(got.models.map((m: any) => m.id), ["big", "small"]);
    // The stored Claude Code choice is not valid here: fall back to this adapter's first entries.
    assert.deepEqual(got.choice, { mode: "ask", model: "big", tutorModel: "big" });
    assert.ok(!JSON.stringify(got).match(/acceptEdits|sonnet/));
    assert.equal((await o.post("/agent-options", { project: shop, mode: "acceptEdits" })).status, 400);
    await o.post("/agent-options", { project: shop, mode: "ask", model: "small" });
    seen.length = 0;
    await o.chat();
    assert.deepEqual(seen, [{ mode: "ask", model: "small" }]);
  } finally {
    o.core.close();
  }
});

test("a mode that is not available keeps its reason and cannot be selected", async () => {
  const o = await start(other);
  try {
    const yolo = (await o.options()).modes[1];
    assert.equal(yolo.available, false);
    assert.equal(yolo.reason, "Needs the Pro plan.");
    const res = await o.post("/agent-options", { project: shop, mode: "yolo" });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /Pro plan/);
  } finally {
    o.core.close();
  }
});
