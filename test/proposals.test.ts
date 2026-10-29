import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

type Call = { name: string; arguments?: unknown };
type Seen = { isError: boolean; text: string };

// A stand-in for Claude Code: it uses aidea's tools over MCP, as Claude Code does, and tells what each call answered.
let script: Call[] = [];
let listTools = false;
const seen: Seen[] = [];
const asBuilder: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ permission }): AsyncGenerator<AgentEvent> {
    const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
    let id = 1;
    const rpc = (method: string, params: unknown) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
      }).then((r) => r.json());
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } });
    if (listTools) {
      const listed = await rpc("tools/list", {});
      yield { type: "text", text: listed.result.tools.map((t: { name: string }) => t.name).join(",") };
    }
    for (const call of script) {
      const reply = await rpc("tools/call", call);
      const result = reply.result ?? { isError: true, content: [{ text: JSON.stringify(reply.error) }] };
      seen.push({ isError: !!result.isError, text: result.content[0].text });
      yield { type: "text", text: result.content[0].text };
    }
  },
};

let core: Awaited<ReturnType<typeof startCore>>;
const scratch: string[] = [];
before(async () => {
  core = await startCore({ port: 0, adapter: asBuilder });
});
after(() => {
  core.close();
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const post = (path: string, body: unknown) =>
  fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const get = (path: string) => fetch(core.url + path);

// A private copy of the studio fixture (it has authored files), opened as a Project.
async function freshProject() {
  const dir = mkdtempSync(join(tmpdir(), "aidea-proposals-"));
  scratch.push(dir);
  cpSync(fixture("studio"), dir, { recursive: true });
  await post("/projects", { path: dir });
  return dir;
}
const fileText = (dir: string, layer: string) => readFileSync(join(dir, ".aidea", `${layer}.json`), "utf8");
const nodesOf = (dir: string, layer: string) => JSON.parse(fileText(dir, layer)).nodes as Record<string, unknown>[];

// One conversation in which the builder makes these tool calls; returns what the interface streamed and what the builder was told.
async function builderCalls(project: string, calls: Call[], withToolList = false) {
  script = calls;
  listTools = withToolList;
  seen.length = 0;
  const res = await post("/chat", { project, message: "propose something" });
  const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l)) as Record<string, any>[];
  return { events, told: [...seen], proposals: events.filter((e) => e.type === "proposal") };
}
const answer = (proposal: Record<string, any>, decision: string) =>
  post("/proposals/answer", { id: proposal.id, secret: proposal.secret, decision });
const pending = async (dir: string) => (await (await get(`/proposals?project=${encodeURIComponent(dir)}`)).json()).proposals as Record<string, any>[];

const cache = {
  id: "cache",
  title: "Cache",
  technology: "Redis",
  rationale: { why: "Quotes are read far more often than written.", rejected: [{ option: "No cache", reason: "The database would be hit on every page." }] },
};
const addCache = { name: "propose_add_node", arguments: { layer: "architecture", node: cache } };

test("the builder's tools are offered next to the permission tool", async () => {
  const dir = await freshProject();
  const { events } = await builderCalls(dir, [], true);
  const names = events.find((e) => e.type === "text")!.text.split(",");
  for (const tool of ["approve", "propose_add_node", "propose_update_node", "propose_remove_node", "list_proposals"]) assert.ok(names.includes(tool), tool);
});

test("adding a Node produces a pending Proposal and changes no file", async () => {
  const dir = await freshProject();
  const before = fileText(dir, "architecture");
  const { proposals, told } = await builderCalls(dir, [addCache]);

  assert.equal(proposals.length, 1);
  assert.deepEqual(
    { layer: proposals[0].layer, kind: proposals[0].kind, nodeId: proposals[0].nodeId, status: proposals[0].status },
    { layer: "architecture", kind: "add", nodeId: "cache", status: "pending" },
  );
  assert.equal(JSON.parse(told[0].text).status, "pending");
  assert.equal(told[0].isError, false);
  assert.equal(fileText(dir, "architecture"), before); // nothing was written

  const list = await pending(dir);
  assert.equal(list.length, 1);
  assert.equal(list[0].secret, undefined); // the answer secret never leaves the stream
  // A new root is drawn from the Architecture layout (ticket 07): a leaf box of its own size, outside the "web-app" boundary.
  const { rect, frame } = list[0];
  assert.deepEqual({ id: rect.id, width: rect.width, height: rect.height }, { id: "cache", width: 180, height: 70 });
  const web = (await (await get(`/proposals?project=${encodeURIComponent(dir)}`)).json()).previews.architecture.groups[0];
  assert.ok(rect.x >= web.x + web.width || rect.x + rect.width <= web.x || rect.y >= web.y + web.height || rect.y + rect.height <= web.y, "outside the boundary");
  // The core also says how to frame it, so the interface can bring it into view (24 of margin on every side).
  assert.deepEqual(frame, { x: rect.x - 24, y: rect.y - 24, width: rect.width + 48, height: rect.height + 48 });
});

test("a Proposal that adds a child Node is placed under its parent", async () => {
  const dir = await freshProject();
  await builderCalls(dir, [{ name: "propose_add_node", arguments: { layer: "architecture", node: { ...cache, parent: "web-app" } } }]);
  // The new child is drawn inside the "web-app" boundary (ticket 07 replaced the parent-connector layout).
  const { rect } = (await pending(dir))[0];
  const web = (await pending(dir))[0].rect && (await (await get(`/proposals?project=${encodeURIComponent(dir)}`)).json()).previews.architecture.groups[0];
  assert.ok(rect.x >= web.x && rect.y >= web.y && rect.x + rect.width <= web.x + web.width && rect.y + rect.height <= web.y + web.height);
});

test("accepting writes the Node to the authored file and it shows up on the layer; rejecting leaves everything as it was", async () => {
  const dir = await freshProject();
  const before = fileText(dir, "architecture");

  const rejected = (await builderCalls(dir, [addCache])).proposals[0];
  assert.equal((await answer(rejected, "reject")).status, 200);
  assert.equal(fileText(dir, "architecture"), before);
  assert.equal((await pending(dir)).length, 0);

  const accepted = (await builderCalls(dir, [{ ...addCache, arguments: { layer: "architecture", node: { ...cache, id: "cache-2" } } }])).proposals[0];
  assert.equal((await answer(accepted, "accept")).status, 200);
  const nodes = nodesOf(dir, "architecture");
  assert.deepEqual(nodes.map((n) => n.id), ["web-app", "quote-db", "cache-2"]);
  assert.deepEqual(nodes[2], { ...cache, id: "cache-2" });
  const layer = (await (await get(`/authored?project=${encodeURIComponent(dir)}`)).json()).layers.architecture;
  assert.equal(layer.nodes.length, 3);
  assert.equal((await pending(dir)).length, 0);
});

test("a builder Proposal refused because the id is waiting or the Node exists tells the interface why; a malformed call does not", async () => {
  const dir = await freshProject();
  const { events, told } = await builderCalls(dir, [
    addCache,
    addCache, // the same id again: still waiting
    { name: "propose_add_node", arguments: { layer: "architecture", node: { ...cache, id: "web-app" } } }, // already on the layer
    { name: "propose_add_node", arguments: { layer: "code", node: cache } }, // malformed
    { name: "propose_add_node", arguments: { layer: "architecture", node: { ...cache, id: "other", rationale: undefined } } }, // malformed
  ]);
  const waiting = events.find((e) => e.type === "proposal")!;
  const refused = events.filter((e) => e.type === "proposal_refused");
  assert.equal(refused.length, 2);
  assert.deepEqual(
    { reason: refused[0].reason, nodeId: refused[0].nodeId, layer: refused[0].layer, proposalId: refused[0].proposalId },
    { reason: "pending", nodeId: "cache", layer: "architecture", proposalId: waiting.id },
  );
  assert.deepEqual({ reason: refused[1].reason, nodeId: refused[1].nodeId, proposalId: refused[1].proposalId }, { reason: "exists", nodeId: "web-app", proposalId: undefined });
  assert.equal(refused[0].source, "builder");
  assert.equal(refused[0].secret, undefined);
  assert.match(told[1].text, /already pending/); // the builder still hears the error
  assert.equal(told[1].isError, true);
});

test("invalid tool input is refused with a message the builder can act on, and creates no Proposal", async () => {
  const dir = await freshProject();
  const bad: [Call, RegExp][] = [
    [{ name: "propose_add_node", arguments: { layer: "architecture", node: { ...cache, rationale: undefined } } }, /rationale/],
    [{ name: "propose_add_node", arguments: { layer: "code", node: cache } }, /layer/],
    [{ name: "propose_add_node", arguments: { layer: "business", node: { id: "x", title: "X", rationale: cache.rationale } } }, /block/],
    [{ name: "propose_add_node", arguments: { layer: "architecture", node: { ...cache, id: "web-app" } } }, /already exists/],
    [{ name: "propose_add_node", arguments: { layer: "architecture", node: { ...cache, parent: "ghost" } } }, /parent/],
    [{ name: "propose_add_node", arguments: { layer: "architecture", node: "cache" } }, /object/],
    [{ name: "propose_update_node", arguments: { layer: "architecture", id: "ghost", changes: { title: "X" } } }, /not found/i],
    [{ name: "propose_update_node", arguments: { layer: "architecture", id: "web-app", changes: { id: "renamed" } } }, /id/],
    [{ name: "propose_remove_node", arguments: { layer: "architecture", id: "ghost" } }, /not found/i],
  ];
  const { events, told } = await builderCalls(dir, bad.map(([call]) => call));
  assert.equal(events.filter((e) => e.type === "proposal").length, 0);
  assert.equal((await pending(dir)).length, 0);
  told.forEach((t, i) => {
    assert.equal(t.isError, true, JSON.stringify(bad[i][0]));
    assert.match(t.text, bad[i][1], JSON.stringify(bad[i][0]));
  });
});

test("two pending proposals for the same new Node are not allowed", async () => {
  const dir = await freshProject();
  const { proposals, told } = await builderCalls(dir, [addCache, addCache]);
  assert.equal(proposals.length, 1);
  assert.equal(told[1].isError, true);
  assert.match(told[1].text, /already pending/);
});

test("updating and removing Nodes: accepted changes touch only that Node and keep the order", async () => {
  const dir = await freshProject();
  const update = { name: "propose_update_node", arguments: { layer: "architecture", id: "web-app", changes: { technology: "Python + FastAPI" } } };
  const first = (await builderCalls(dir, [update])).proposals[0];
  assert.equal(first.kind, "update");
  // An update highlights the Node that already exists: its own place on the layer.
  // (web-app now has a child, so its own place is its boundary box.)
  assert.deepEqual((await pending(dir))[0].rect, { id: "web-app", x: -20, y: -20, width: 220, height: 110 });
  await answer(first, "accept");
  let nodes = nodesOf(dir, "architecture");
  assert.equal(nodes[0].technology, "Python + FastAPI");
  assert.equal(nodes[0].title, "Web app"); // what was not changed stays
  assert.deepEqual(nodes[1], JSON.parse(readFileSync(join(fixture("studio"), ".aidea", "architecture.json"), "utf8")).nodes[1]);

  const removal = (await builderCalls(dir, [{ name: "propose_remove_node", arguments: { layer: "architecture", id: "quote-db" } }])).proposals[0];
  assert.equal(removal.kind, "remove");
  await answer(removal, "accept");
  nodes = nodesOf(dir, "architecture");
  assert.deepEqual(nodes.map((n) => n.id), ["web-app"]);
});

test("a Proposal can be added to a layer that has no file yet", async () => {
  const dir = await freshProject();
  rmSync(join(dir, ".aidea", "requirements.json"));
  const story = { id: "us-1", title: "Sign in", as: "a shop owner", want: "to sign in", so: "I see my quotes", rationale: { why: "Quotes are private.", rejected: [] } };
  const proposal = (await builderCalls(dir, [{ name: "propose_add_node", arguments: { layer: "requirements", node: story } }])).proposals[0];
  assert.equal((await answer(proposal, "accept")).status, 200);
  assert.deepEqual(nodesOf(dir, "requirements"), [story]);
});

test("only the interface that holds the conversation's secret can decide a Proposal", async () => {
  const dir = await freshProject();
  const proposal = (await builderCalls(dir, [addCache])).proposals[0];
  assert.equal((await post("/proposals/answer", { id: proposal.id, decision: "accept" })).status, 400);
  assert.equal((await post("/proposals/answer", { id: proposal.id, secret: "0".repeat(proposal.secret.length), decision: "accept" })).status, 403);
  assert.equal((await post("/proposals/answer", { id: proposal.id, secret: proposal.secret, decision: "maybe" })).status, 400);
  assert.equal((await post("/proposals/answer", { id: "prop-none", secret: proposal.secret, decision: "accept" })).status, 404);
  assert.equal(nodesOf(dir, "architecture").length, 2); // nothing was written by any of those
  assert.equal((await answer(proposal, "accept")).status, 200);
  assert.equal((await answer(proposal, "reject")).status, 404); // decided once
});

test("if the file changed since the Proposal was made, accepting is refused and the Proposal stays pending", async () => {
  const dir = await freshProject();
  const proposal = (await builderCalls(dir, [addCache])).proposals[0];
  const doc = JSON.parse(fileText(dir, "architecture"));
  doc.nodes.push({ ...cache, title: "Added by hand" });
  writeFileSync(join(dir, ".aidea", "architecture.json"), JSON.stringify(doc));
  const res = await answer(proposal, "accept");
  assert.equal(res.status, 409);
  assert.match((await res.json()).error, /already exists/);
  assert.equal(nodesOf(dir, "architecture").length, 3); // only the hand edit
  assert.equal((await pending(dir)).length, 1);
});

test("the builder can see which Proposals were decided, never their secrets", async () => {
  const dir = await freshProject();
  const proposal = (await builderCalls(dir, [addCache])).proposals[0];
  await answer(proposal, "accept");
  const { told } = await builderCalls(dir, [{ name: "list_proposals" }]);
  const listed = JSON.parse(told[0].text).proposals;
  assert.deepEqual(listed.map((p: { id: string; status: string }) => [p.id, p.status]), [[proposal.id, "accepted"]]);
  assert.ok(!told[0].text.includes(proposal.secret));
});

test("a Proposal is never written through a link that leaves the Project", async () => {
  const dir = await freshProject();
  const outside = mkdtempSync(join(tmpdir(), "aidea-outside-"));
  scratch.push(outside);
  rmSync(join(dir, ".aidea"), { recursive: true, force: true });
  symlinkSync(outside, join(dir, ".aidea"), "junction");
  const proposal = (await builderCalls(dir, [addCache])).proposals[0];
  assert.equal((await answer(proposal, "accept")).status, 409);
  assert.deepEqual(readdirNames(outside), []);
});

import { readdirSync } from "node:fs";
const readdirNames = (dir: string) => readdirSync(dir);

test("a Node's parent cannot be left dangling by a proposal, whatever order they are decided in", async () => {
  const dir = await freshProject();
  const refused: [Call, RegExp][] = [
    [{ name: "propose_update_node", arguments: { layer: "architecture", id: "quote-db", changes: { parent: "ghost" } } }, /parent/],
    [{ name: "propose_update_node", arguments: { layer: "architecture", id: "web-app", changes: { parent: "web-app" } } }, /parent/],
    [{ name: "propose_remove_node", arguments: { layer: "architecture", id: "web-app" } }, /parent of/],
  ];
  const { proposals, told } = await builderCalls(dir, refused.map(([call]) => call));
  assert.equal(proposals.length, 0);
  told.forEach((t, i) => {
    assert.equal(t.isError, true, JSON.stringify(refused[i][0]));
    assert.match(t.text, refused[i][1]);
  });

  // A child proposed under a pending parent: if the parent is rejected, accepting the child is refused.
  const [parent, child] = (await builderCalls(dir, [addCache, { name: "propose_add_node", arguments: { layer: "architecture", node: { ...cache, id: "cache-tls", parent: "cache" } } }])).proposals;
  await answer(parent, "reject");
  assert.equal((await answer(child, "accept")).status, 409);
  assert.deepEqual(nodesOf(dir, "architecture").map((n) => n.id), ["web-app", "quote-db"]);
});

test("a file already sitting where the temporary copy would go does not redirect the write", async (t) => {
  const dir = await freshProject();
  const outside = mkdtempSync(join(tmpdir(), "aidea-outside-"));
  scratch.push(outside);
  const target = join(outside, "victim.txt");
  writeFileSync(target, "untouched");
  try {
    symlinkSync(target, join(dir, ".aidea", "architecture.json.tmp"), "file");
  } catch {
    return t.skip("this machine does not allow creating file links");
  }
  const proposal = (await builderCalls(dir, [addCache])).proposals[0];
  assert.equal((await answer(proposal, "accept")).status, 200);
  assert.equal(readFileSync(target, "utf8"), "untouched");
  assert.equal(nodesOf(dir, "architecture").length, 3);
});
