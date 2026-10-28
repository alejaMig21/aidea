import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startCore } from "../src/core/server.ts";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const scratch: string[] = [];
const cores: { close: () => void }[] = [];
before(async () => {
  t = await startTestCore();
});
after(() => {
  t.core.close();
  for (const core of cores) core.close();
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const authored = async (path: string) => (await t.post("/projects", { path }), await t.get(`/authored?project=${encodeURIComponent(path)}`)).json() as Promise<any>;
const rationale = { why: "Because.", rejected: [] };
const node = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: id, technology: "Python", rationale, ...extra });

// A project whose architecture file holds exactly these Nodes.
async function projectWith(nodes: unknown[]) {
  const dir = mkdtempSync(join(tmpdir(), "aidea-arch-"));
  scratch.push(dir);
  mkdirSync(join(dir, ".aidea"));
  writeFileSync(join(dir, ".aidea", "architecture.json"), JSON.stringify({ nodes }));
  await t.post("/projects", { path: dir });
  return dir;
}

test("kind, description and relations come back as written", async () => {
  await t.post("/projects", { path: fixture("studio-c4") });
  const layer = (await authored(fixture("studio-c4"))).layers.architecture;
  assert.deepEqual(layer.errors, []);
  assert.deepEqual(layer.nodes.map((n: any) => [n.id, n.kind]), [["designer", "person"], ["web-app", "container"], ["quote-db", "container"], ["mailer", "system"]]);
  assert.equal(layer.nodes[0].description, "Builds a quote for a customer.");
  assert.deepEqual(layer.nodes[1].relations, [
    { to: "quote-db", label: "Reads and writes quotes", technology: "SQL" },
    { to: "mailer", label: "Sends the quote by email" },
  ]);
});

test("old files load exactly as before: no new field appears", async () => {
  await t.post("/projects", { path: fixture("studio") });
  const nodes = (await authored(fixture("studio"))).layers.architecture.nodes;
  for (const n of nodes) for (const f of ["kind", "description", "relations"]) assert.equal(f in n, false);
});

test("a relation to a missing Node is dropped with an error naming the Node and the field; the Node survives", async () => {
  const dir = await projectWith([node("a", { relations: [{ to: "ghost", label: "uses" }, { to: "b", label: "calls" }] }), node("b")]);
  const layer = (await authored(dir)).layers.architecture;
  assert.deepEqual(layer.nodes.map((n: any) => n.id), ["a", "b"]);
  assert.deepEqual(layer.nodes[0].relations, [{ to: "b", label: "calls" }]);
  assert.deepEqual(layer.errors, [{ file: ".aidea/architecture.json", message: 'node "a": "relations[0].to" refers to unknown id "ghost"' }]);
});

test("a bad relation is dropped alone with an error naming the field; the Node survives", async () => {
  const dir = await projectWith([
    node("a", { relations: [{ label: "no target" }, { to: "b" }, { to: "b", label: "ok", technology: 5 }, "b", { to: "b", label: "fine", technology: "HTTP" }] }),
    node("b"),
  ]);
  const layer = (await authored(dir)).layers.architecture;
  assert.deepEqual(layer.nodes[0].relations, [{ to: "b", label: "fine", technology: "HTTP" }]);
  assert.deepEqual(layer.errors.map((e: any) => e.message), [
    'nodes[0]: "relations[0].to" must be a non-empty string',
    'nodes[0]: "relations[1].label" must be a non-empty string',
    'nodes[0]: "relations[2].technology" must be a string when present',
    'nodes[0]: "relations[3]" must be an object',
  ]);
});

test("an unknown kind, a bad description or a relations that is not a list drops that Node and names the field", async () => {
  const dir = await projectWith([
    node("a", { kind: "database" }),
    node("b", { description: 7 }),
    node("c", { description: "  " }),
    node("d", { relations: "a" }),
    node("e", { kind: "component", description: "Fine." }),
  ]);
  const layer = (await authored(dir)).layers.architecture;
  assert.deepEqual(layer.nodes.map((n: any) => n.id), ["e"]);
  assert.deepEqual(layer.errors.map((e: any) => e.message), [
    'nodes[0]: "kind" must be one of: person, system, container, component',
    'nodes[1]: "description" must be a non-empty string when present',
    'nodes[2]: "description" must be a non-empty string when present',
    'nodes[3]: "relations" must be an array when present',
  ]);
});

test("cycles in parent stay ignored and a Node may relate to itself", async () => {
  const dir = await projectWith([node("a", { parent: "b", relations: [{ to: "a", label: "loops" }] }), node("b", { parent: "a" })]);
  const layer = (await authored(dir)).layers.architecture;
  assert.deepEqual(layer.errors, []);
  assert.equal(layer.nodes.length, 2);
  assert.equal((await t.get(`/layout?project=${encodeURIComponent(dir)}&layer=architecture`)).status, 200);
});

// The builder as a stand-in (as in proposals.test.ts): one tool call, then the person's decision.
async function builder(dir: string, name: string, args: unknown) {
  let reply: any;
  const core = await startCore({
    port: 0,
    adapter: {
      options: { modes: [], models: [] },
      run: async function* ({ permission }) {
        const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
        const rpc = (method: string, params: unknown) =>
          fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: 2, method, params }) }).then((r) => r.json());
        await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } });
        reply = name === "tools/list" ? (await rpc("tools/list", {})).result : (await rpc("tools/call", { name, arguments: args })).result;
        yield { type: "text", text: "done" };
      },
    },
  });
  cores.push(core);
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  await post("/projects", { path: dir });
  const events = (await (await post("/chat", { project: dir, message: "go" })).text()).trim().split("\n").map((l) => JSON.parse(l));
  const proposal = events.find((e: any) => e.type === "proposal");
  return { reply, proposal, accept: () => post("/proposals/answer", { id: proposal.id, secret: proposal.secret, decision: "accept" }) };
}

function copyOfC4() {
  const dir = mkdtempSync(join(tmpdir(), "aidea-arch-"));
  scratch.push(dir);
  cpSync(fixture("studio-c4"), dir, { recursive: true });
  return dir;
}

test("the builder's tool descriptions mention kind, description and relations", async () => {
  const { reply } = await builder(copyOfC4(), "tools/list", {});
  const text = reply.tools.map((x: any) => x.description).join(" ");
  for (const word of ["kind", "description", "relations"]) assert.match(text, new RegExp(word));
});

test("a Proposal adds a Node with the new fields; accepting writes it in the existing format", async () => {
  const dir = copyOfC4();
  const added = node("cache", { kind: "container", description: "Keeps hot quotes.", relations: [{ to: "quote-db", label: "Falls back to", technology: "SQL" }] });
  const { accept } = await builder(dir, "propose_add_node", { layer: "architecture", node: added });
  assert.equal((await accept()).status, 200);
  const layer = (await authored(dir)).layers.architecture;
  assert.deepEqual(layer.errors, []);
  assert.deepEqual(layer.nodes.at(-1), added);
});

test("a Proposal that changes the new fields is accepted; a bad field is refused with the same message", async () => {
  const dir = copyOfC4();
  const ok = await builder(dir, "propose_update_node", { layer: "architecture", id: "quote-db", changes: { relations: [{ to: "web-app", label: "Notifies" }], kind: "component" } });
  assert.equal((await ok.accept()).status, 200);
  const db = (await authored(dir)).layers.architecture.nodes.find((n: any) => n.id === "quote-db");
  assert.deepEqual([db.kind, db.relations], ["component", [{ to: "web-app", label: "Notifies" }]]);

  for (const [changes, message] of [
    [{ kind: "database" }, '"kind" must be one of'],
    [{ description: 3 }, '"description" must be a non-empty string when present'],
    [{ relations: [{ to: "web-app" }] }, '"relations[0].label" must be a non-empty string'],
    [{ relations: [{ to: "ghost", label: "x" }] }, '"relations[0].to" refers to unknown id "ghost"'],
  ] as const) {
    const bad = await builder(dir, "propose_update_node", { layer: "architecture", id: "web-app", changes });
    assert.equal(bad.reply.isError, true);
    assert.ok(bad.reply.content[0].text.includes(message), bad.reply.content[0].text);
  }
});
