import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture, viaCore } from "./helpers.ts";

// A stand-in builder that does whatever the test says to the Project's files while its turn runs.
let mcpUrl = "";
let during: (dir: string) => Promise<void> | void = () => {};
const builder: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ cwd, permission }): AsyncGenerator<AgentEvent> {
    mcpUrl = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url;
    await during(cwd);
    yield { type: "text", text: "done" };
  },
};

let core: Awaited<ReturnType<typeof startCore>>;
const scratch: string[] = [];
before(async () => {
  core = await startCore({ port: 0, adapter: builder });
});
after(() => {
  core.close();
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const post = (path: string, body: unknown) =>
  fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function freshProject() {
  const dir = mkdtempSync(join(tmpdir(), "aidea-guard-"));
  scratch.push(dir);
  cpSync(fixture("studio"), dir, { recursive: true });
  await post("/projects", { path: dir });
  return dir;
}
async function turn(project: string) {
  const res = await post("/chat", { project, message: "go" });
  return (await res.text()).trim().split("\n").map((l) => JSON.parse(l)) as Record<string, any>[];
}
// A turn in which the builder proposes `node`, the person accepts it while the turn still runs, and then `after` happens.
async function acceptedMidTurn(project: string, node: object, after: (dir: string) => void) {
  let accepted!: () => void;
  const gate = new Promise<void>((r) => (accepted = r));
  during = async (dir) => {
    const rpc = (method: string, params: unknown) => fetch(mcpUrl, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } });
    await viaCore(core, mcpUrl, rpc, { name: "propose_add_node", arguments: { layer: "architecture", node } });
    await gate;
    after(dir);
  };
  const res = await post("/chat", { project, message: "go" });
  const events: Record<string, any>[] = [];
  let buffer = "";
  const decoder = new TextDecoder();
  for await (const chunk of res.body as any) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines.filter(Boolean)) {
      const event = JSON.parse(line);
      events.push(event);
      if (event.type === "proposal") {
        const ok = await post("/proposals/answer", { id: event.id, secret: event.secret, decision: "accept" });
        assert.equal(ok.status, 200);
        accepted();
      }
    }
  }
  return events;
}
const reported = (events: Record<string, any>[]) => events.filter((e) => e.type === "authored_changed");

test("a change to an authored file during a turn is reported once with its name, and restoring brings back every byte", async () => {
  const dir = await freshProject();
  const file = join(dir, ".aidea", "business.json");
  const before = readFileSync(file);
  during = () => writeFileSync(file, '{"nodes":[]}');
  const events = reported(await turn(dir));
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].files, [{ file: ".aidea/business.json", change: "changed" }]);

  const res = await post("/authored/restore", { id: events[0].id });
  assert.equal(res.status, 200);
  assert.ok(readFileSync(file).equals(before));
  assert.equal((await post("/authored/restore", { id: events[0].id })).status, 404); // once
});

test("a file created or removed during a turn, outside any Proposal, is reported and restored too", async () => {
  const dir = await freshProject();
  const made = join(dir, ".aidea", "notes", "001-x.json");
  const gone = join(dir, ".aidea", "requirements.json");
  const kept = readFileSync(gone);
  during = () => {
    mkdirSync(join(dir, ".aidea", "notes"));
    writeFileSync(made, "{}");
    rmSync(gone);
  };
  const [event] = reported(await turn(dir));
  assert.deepEqual(event.files.map((f: any) => f.change).sort(), ["created", "removed"]);
  await post("/authored/restore", { id: event.id });
  assert.ok(!existsSync(made));
  assert.ok(readFileSync(gone).equals(kept));
});

test("a change made by an accepted Proposal during the turn is never reported", async () => {
  const dir = await freshProject();
  const node = { id: "cache", title: "Cache", technology: "Redis", rationale: { why: "Reads dominate.", rejected: [{ option: "No cache", reason: "Slow." }] } };
  const events = await acceptedMidTurn(dir, node, () => {});
  assert.ok(events.some((e) => e.type === "proposal"));
  assert.equal(reported(events).length, 0);
});

test("a Proposal accepted during the turn does not hide a different file the builder changed", async () => {
  const dir = await freshProject();
  const node = { id: "cache2", title: "Cache", technology: "Redis", rationale: { why: "Reads dominate.", rejected: [{ option: "No cache", reason: "Slow." }] } };
  const [event] = reported(await acceptedMidTurn(dir, node, () => writeFileSync(join(dir, ".aidea", "business.json"), "{}")));
  assert.deepEqual(event.files.map((f: any) => f.file), [".aidea/business.json"]);
});

test("the person's own edit between turns is never reported, and restoring never overwrites a later edit", async () => {
  const dir = await freshProject();
  const file = join(dir, ".aidea", "business.json");
  during = () => {};
  writeFileSync(file, '{"nodes":[]}'); // the person edits by hand before the turn
  assert.equal(reported(await turn(dir)).length, 0);

  during = () => writeFileSync(file, '{"nodes":[1]}');
  const [event] = reported(await turn(dir));
  writeFileSync(file, '{"nodes":[2]}'); // the person edits again before pressing Restore
  const res = await post("/authored/restore", { id: event.id });
  assert.deepEqual(await res.json(), { ok: true, restored: [], skipped: [".aidea/business.json"] });
  assert.equal(readFileSync(file, "utf8"), '{"nodes":[2]}');
});

test("a turn that touches nothing reports nothing", async () => {
  const dir = await freshProject();
  during = () => {};
  assert.equal(reported(await turn(dir)).length, 0);
});

test("the builder's denied tools include the notebook editor and shell commands that name .aidea", async () => {
  let denied: string[] = [];
  const spy: Adapter = { options: { modes: [], models: [] }, run: async function* ({ permission }) { denied = permission!.deniedTools; yield { type: "text", text: "x" }; } };
  const other = await startCore({ port: 0, adapter: spy });
  try {
    const dir = mkdtempSync(join(tmpdir(), "aidea-guard-"));
    scratch.push(dir);
    cpSync(fixture("studio"), dir, { recursive: true });
    await fetch(other.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: dir }) });
    await (await fetch(other.url + "/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: dir, message: "go" }) })).text();
  } finally {
    other.close();
  }
  assert.ok(denied.some((d) => d.startsWith("NotebookEdit")));
  assert.ok(denied.some((d) => d.startsWith("Bash(") && d.includes(".aidea")));
});

// Run-and-terminal: `.aidea/run.json` is not an authored layer. The person's consent (the hash Play checks) is what protects it, so the guard must not
// report it: accepting a recipe while the Builder's turn still runs would otherwise offer "Restore", which deletes the recipe the person just accepted.
test("a run recipe the person accepts while the Builder's turn still runs is not reported as a change without a proposal", async () => {
  const project = await freshProject();
  const id = ((await (await post("/projects", { path: project })).json()) as any).id;
  let accepted!: () => void;
  const gate = new Promise<void>((r) => (accepted = r));
  during = async () => {
    const rpc = (method: string, params: unknown) => fetch(mcpUrl, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } });
    await (await rpc("tools/call", { name: "propose_run_recipe", arguments: { parts: [{ name: "job", command: "node job.js" }] } })).text();
    await gate;
  };
  const res = await post("/chat", { project, message: "go" });
  const events: Record<string, any>[] = [];
  let buffer = "";
  const decoder = new TextDecoder();
  for await (const chunk of res.body as any) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop()!;
    for (const line of lines.filter(Boolean)) {
      const event = JSON.parse(line);
      events.push(event);
      if (event.type === "run_recipe_proposal") {
        const ok = await post("/plugins/run/call/decide", { project: id, id: event.id, secret: event.secret, decision: "accept" });
        assert.equal(ok.status, 200);
        accepted();
      }
    }
  }
  assert.ok(existsSync(join(project, ".aidea", "run.json")), "the accepted recipe is on disk");
  assert.deepEqual(events.filter((e) => e.type === "authored_changed"), []);
});

test("a recipe the Builder changes by itself is not an authored change either: Play asks the person again instead", async () => {
  const store = mkdtempSync(join(tmpdir(), "aidea-guard-store-"));
  scratch.push(store);
  const own = await startCore({ port: 0, adapter: builder, pluginsDir: store }); // accepting a recipe needs a plugin store to remember it in
  try {
    const send = (path: string, body: unknown) => fetch(own.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const dir = mkdtempSync(join(tmpdir(), "aidea-guard-"));
    scratch.push(dir);
    cpSync(fixture("studio"), dir, { recursive: true });
    const id = ((await (await send("/projects", { path: dir })).json()) as any).id;
    mkdirSync(join(dir, ".aidea"), { recursive: true });
    writeFileSync(join(dir, ".aidea", "run.json"), JSON.stringify({ parts: [{ name: "job", command: "node job.js" }] }));
    assert.equal((await send("/plugins/run/call/accept", { project: id })).status, 200);
    during = (cwd) => { writeFileSync(join(cwd, ".aidea", "run.json"), JSON.stringify({ parts: [{ name: "job", command: "node evil.js" }] })); };
    const events = (await (await send("/chat", { project: dir, message: "go" })).text()).trim().split("\n").map((l) => JSON.parse(l)) as Record<string, any>[];
    assert.deepEqual(events.filter((e) => e.type === "authored_changed"), []);
    const play = (await (await send("/plugins/run/call/play", { project: id })).json()) as any;
    assert.equal(play.reason, "needs-accept");
    assert.deepEqual(play.changes.changed, ["job"]);
  } finally { during = () => {}; own.close(); }
});
