import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// tutor-rewrite 01: the Tutor is one session. It needs an Open Project, accepts any question, and the places that used to start a kind of class only attach context to it.
const scratch = mkdtempSync(join(tmpdir(), "aidea-tutor-one-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }));

const messages: string[] = [];
const fake: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ message, role }): AsyncGenerator<AgentEvent> {
    if (role === "tutor") messages.push(message);
    yield { type: "text", text: "ok" };
  },
};
async function start() {
  const project = join(scratch, "shop");
  try { cpSync(fixture("shop"), project, { recursive: true }); } catch { /* already copied */ }
  const core = await startCore({ port: 0, adapter: fake, learnerDir: join(scratch, "learner"), recentsFile: join(scratch, "recents.json"), preferencesFile: join(scratch, "prefs.json") });
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  await post("/projects", { path: project });
  const session = async (body: Record<string, unknown>) => {
    const before = messages.length;
    const res = await post("/tutor/classes", { project, ...body });
    const text = await res.text();
    return { status: res.status, text, message: messages.length > before ? messages.at(-1)! : undefined };
  };
  return { core, project, session, post };
}

test("with no Open Project the Tutor does not start and says why in plain words", async () => {
  const t = await start();
  try {
    const r = await (await t.post("/tutor/classes", { project: join(scratch, "not-open"), message: "What is a queue?" })).json() as any;
    assert.match(r.error, /open a project/i);
    assert.doesNotMatch(r.error, /Project that is already open/);
    const none = await (await t.post("/tutor/classes", { message: "hi" })).json() as any;
    assert.match(none.error, /open a project/i);
  } finally { t.core.close(); }
});

test("a free question about anything starts a session with exactly that question", async () => {
  const t = await start();
  try {
    const r = await t.session({ message: "How do I learn Rust ownership?" });
    assert.equal(r.status, 200);
    assert.match(r.message!, /How do I learn Rust ownership\?/);
  } finally { t.core.close(); }
});

test("the old entry points start the same session with context attached, and the person's question comes first", async () => {
  const t = await start();
  try {
    const guide = await t.session({ guide: true });
    assert.match(guide.message!, /aidea/i);
    const withQuestion = await t.session({ guide: true, message: "What is the Canvas for?" });
    assert.match(withQuestion.message!, /^The person asks: What is the Canvas for\?/);
    assert.match(withQuestion.message!, /aidea/i, "the context follows the question");
    const sel = await t.session({ selection: "def total(items):", message: "Why a function here?" });
    assert.match(sel.message!, /Why a function here\?/);
    assert.match(sel.message!, /def total\(items\):/);
    const layer = await t.session({ layer: "business", message: "Help me start" });
    assert.match(layer.message!, /Help me start/);
    assert.match(layer.message!, /business/i);
  } finally { t.core.close(); }
});

test("contexts combine in one session, and a bad question is refused", async () => {
  const t = await start();
  try {
    const both = await t.session({ guide: true, selection: "x = 1", message: "Both" });
    assert.match(both.message!, /Both/);
    assert.match(both.message!, /aidea/i);
    assert.match(both.message!, /x = 1/);
    const bad = await t.post("/tutor/classes", { project: t.project, message: 5 });
    assert.equal(bad.status, 400);
    const long = await t.post("/tutor/classes", { project: t.project, message: "x".repeat(20_001) });
    assert.equal(long.status, 400);
  } finally { t.core.close(); }
});

test("a session with no context still opens with a review question when there is one, and a session with context never does", async () => {
  const t = await start();
  try {
    const plain = await t.session({});
    assert.match(plain.message!, /class/i);
    const ctx = await t.session({ guide: true });
    assert.doesNotMatch(ctx.message!, /review question/i);
  } finally { t.core.close(); }
});
