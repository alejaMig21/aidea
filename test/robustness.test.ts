import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const scratch: string[] = [];
const tempDir = () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-robust-"));
  scratch.push(dir);
  return dir;
};

before(async () => {
  t = await startTestCore();
});
after(() => {
  t.core.close();
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

test("an agent that fails mid-reply ends the stream with an error event and the core keeps running", { timeout: 15_000 }, async () => {
  const failing: Adapter = {
    run: async function* () {
      yield { type: "session", sessionId: "s1" };
      throw new Error("boom at C:\\secret\\place");
    },
  };
  const core = await startCore({ port: 0, adapter: failing });
  try {
    await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: fixture("shop") }) });
    const res = await fetch(core.url + "/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: fixture("shop"), message: "hi" }) });
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    assert.equal(lines[0].type, "session");
    assert.equal(lines.at(-1).type, "error");
    assert.equal(lines.at(-1).code, "failed");
    assert.ok(!JSON.stringify(lines).includes("secret"));
    assert.equal((await fetch(core.url + "/projects")).status, 200);
  } finally {
    core.close();
  }
});

test("/chat accepts a query string on its URL", async () => {
  const res = await t.post("/chat?x=1", "not json");
  assert.equal(res.status, 400);
});

test("a file whose name starts with two dots is still inside the Project", async () => {
  const dir = tempDir();
  writeFileSync(join(dir, "..odd.py"), "def f():\n    return 1\n");
  await t.post("/projects", { path: dir });
  const res = await t.get(`/source?project=${encodeURIComponent(dir)}&node=${encodeURIComponent("..odd")}`);
  assert.equal(res.status, 200);
});

test("a malformed AIDEA_EDITOR_ARGS is reported clearly instead of crashing the request", async () => {
  await t.post("/projects", { path: fixture("shop") });
  const before = process.env.AIDEA_EDITOR_ARGS;
  process.env.AIDEA_EDITOR_ARGS = "not json";
  try {
    const res = await t.post("/open-in-editor", { project: fixture("shop"), node: "cart.Cart.add" });
    assert.equal(res.status, 500);
    assert.match((await res.json()).error, /AIDEA_EDITOR_ARGS/);
  } finally {
    if (before === undefined) delete process.env.AIDEA_EDITOR_ARGS;
    else process.env.AIDEA_EDITOR_ARGS = before;
  }
});

test("an editor that cannot be started is reported as 502, not as an internal error", async () => {
  await t.post("/projects", { path: fixture("shop") });
  const before = process.env.AIDEA_EDITOR;
  process.env.AIDEA_EDITOR = "definitely-not-an-editor.cmd"; // Windows refuses .cmd files without a shell, synchronously
  try {
    const res = await t.post("/open-in-editor", { project: fixture("shop"), node: "cart.Cart.add" });
    assert.equal(res.status, 502);
    assert.match((await res.json()).error, /Could not start the editor/);
  } finally {
    if (before === undefined) delete process.env.AIDEA_EDITOR;
    else process.env.AIDEA_EDITOR = before;
  }
});

test("an .aidea folder that is a link to somewhere else is ignored", async () => {
  const outside = tempDir();
  writeFileSync(
    join(outside, "business.json"),
    JSON.stringify({ nodes: [{ id: "b1", title: "Leak", block: "channels", rationale: { why: "x", rejected: [] } }] }),
  );
  const project = tempDir();
  writeFileSync(join(project, "app.py"), "def run():\n    return 1\n");
  symlinkSync(outside, join(project, ".aidea"), "junction");
  await t.post("/projects", { path: project });
  const body = await (await t.get(`/authored?project=${encodeURIComponent(project)}`)).json();
  assert.deepEqual(body.layers.business.nodes, []);
});

test("an Architecture Node whose parent does not exist is reported and dropped", async () => {
  const project = tempDir();
  writeFileSync(join(project, "app.py"), "def run():\n    return 1\n");
  mkdirSync(join(project, ".aidea"));
  writeFileSync(
    join(project, ".aidea", "architecture.json"),
    JSON.stringify({
      nodes: [
        { id: "web", title: "Web app", technology: "Flask", rationale: { why: "x", rejected: [] } },
        { id: "db", title: "Database", technology: "SQLite", parent: "ghost", rationale: { why: "x", rejected: [] } },
      ],
    }),
  );
  await t.post("/projects", { path: project });
  const body = await (await t.get(`/authored?project=${encodeURIComponent(project)}`)).json();
  assert.deepEqual(body.layers.architecture.nodes.map((n: { id: string }) => n.id), ["web"]);
  assert.match(body.layers.architecture.errors[0].message, /parent/);
});
