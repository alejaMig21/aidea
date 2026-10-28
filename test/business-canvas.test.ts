import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";

// A stand-in for Claude Code that makes one MCP tool call, as in proposals.test.ts.
let call: { name: string; arguments: unknown } | null = null;
const asBuilder: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ permission }): AsyncGenerator<AgentEvent> {
    const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
    const rpc = (method: string, params: unknown) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method, params }),
      }).then((r) => r.json());
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } });
    if (call) yield { type: "text", text: JSON.stringify(await rpc("tools/call", call)) };
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

type R = { id: string; x: number; y: number; width: number; height: number };
const why = { why: "because", rejected: [] };
const note = (id: string, block: string) => ({ id, title: id, block, rationale: why });

async function project(nodes: unknown[]) {
  const dir = mkdtempSync(join(tmpdir(), "aidea-business-"));
  scratch.push(dir);
  mkdirSync(join(dir, ".aidea"));
  writeFileSync(join(dir, ".aidea", "business.json"), JSON.stringify({ nodes }));
  await post("/projects", { path: dir });
  return dir;
}
const layoutOf = async (dir: string) =>
  (await (await fetch(`${core.url}/layout?project=${encodeURIComponent(dir)}&layer=business`)).json()) as { rects: R[]; blocks: R[] };
const inside = (n: R, b: R) => n.x >= b.x && n.y >= b.y && n.x + n.width <= b.x + b.width && n.y + n.height <= b.y + b.height;
const overlap = (a: R, b: R) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test("the nine blocks sit in the canonical canvas arrangement, empty ones included", async () => {
  const { blocks } = await layoutOf(await project([note("n1", "value propositions")]));
  assert.equal(blocks.length, 9);
  const b = Object.fromEntries(blocks.map((r) => [r.id, r]));
  const names = ["key partnerships", "key activities", "key resources", "value propositions", "customer relationships", "channels", "customer segments", "cost structure", "revenue streams"];
  for (const name of names) assert.ok(b[name], name);
  // Left to right: partners, activities over resources, value propositions, relationships over channels, segments.
  assert.ok(b["key partnerships"].x < b["key activities"].x);
  assert.equal(b["key activities"].x, b["key resources"].x);
  assert.ok(b["key activities"].x < b["value propositions"].x);
  assert.ok(b["value propositions"].x < b["customer relationships"].x);
  assert.equal(b["customer relationships"].x, b.channels.x);
  assert.ok(b["customer relationships"].x < b["customer segments"].x);
  assert.ok(b["key activities"].y < b["key resources"].y);
  assert.ok(b["customer relationships"].y < b.channels.y);
  // The three tall blocks run the full height of the top part.
  const tall = ["key partnerships", "value propositions", "customer segments"].map((n) => b[n]);
  assert.equal(new Set(tall.map((r) => r.y)).size, 1);
  assert.equal(new Set(tall.map((r) => r.height)).size, 1);
  assert.equal(tall[0].y + tall[0].height, Math.max(b["key resources"].y + b["key resources"].height, b.channels.y + b.channels.height));
  // Cost structure and revenue streams share the bottom, under everything, edge to edge.
  assert.equal(b["cost structure"].y, b["revenue streams"].y);
  assert.ok(b["cost structure"].y >= tall[0].y + tall[0].height);
  assert.equal(b["cost structure"].x, b["key partnerships"].x);
  assert.ok(b["cost structure"].x + b["cost structure"].width < b["revenue streams"].x);
  assert.equal(b["revenue streams"].x + b["revenue streams"].width, b["customer segments"].x + b["customer segments"].width);
});

test("each note sits inside its block, no two overlap, and a block grows to hold its notes", async () => {
  const empty = (await layoutOf(await project([]))).blocks.find((r) => r.id === "channels")!;
  const nodes = [
    ...Array.from({ length: 6 }, (_, i) => note(`c${i}`, "channels")),
    ...Array.from({ length: 5 }, (_, i) => note(`r${i}`, "revenue streams")),
    note("v", "value propositions"),
  ];
  const { rects, blocks } = await layoutOf(await project(nodes));
  const block = (id: string) => blocks.find((r) => r.id === id)!;
  assert.equal(rects.length, nodes.length);
  for (const n of nodes) assert.ok(inside(rects.find((r) => r.id === n.id)!, block(n.block)), n.id);
  for (const a of rects) for (const b of rects) if (a !== b) assert.ok(!overlap(a, b), `${a.id} overlaps ${b.id}`);
  assert.ok(block("channels").height > empty.height);
  // Blocks never overlap either, however many notes they hold.
  for (const a of blocks) for (const b of blocks) if (a !== b) assert.ok(!overlap(a, b), `${a.id} overlaps ${b.id}`);
});

test("the same input gives the same layout", async () => {
  const dir = await project([note("a", "channels"), note("b", "channels"), note("c", "cost structure")]);
  assert.deepEqual(await layoutOf(dir), await layoutOf(dir));
});

test("a note whose block is not one of the nine is still an error and is not placed", async () => {
  const dir = await project([note("ok", "channels"), note("bad", "marketing")]);
  const authored = await (await fetch(`${core.url}/authored?project=${encodeURIComponent(dir)}`)).json();
  assert.match(authored.layers.business.errors[0].message, /block/);
  assert.deepEqual((await layoutOf(dir)).rects.map((r) => r.id), ["ok"]);
});

test("a Proposal that adds a Business Node is previewed inside its block", async () => {
  const dir = await project([note("n1", "value propositions")]);
  call = { name: "propose_add_node", arguments: { layer: "business", node: note("n2", "value propositions") } };
  await post("/chat", { project: dir, message: "propose something" }).then((r) => r.text());
  const { proposals } = await (await fetch(`${core.url}/proposals?project=${encodeURIComponent(dir)}`)).json();
  assert.equal(proposals.length, 1);
  const { rects, blocks } = await layoutOf(dir);
  const vp = blocks.find((r) => r.id === "value propositions")!;
  assert.ok(inside(proposals[0].rect, vp));
  assert.ok(!overlap(proposals[0].rect, rects.find((r) => r.id === "n1")!)); // below the note that exists
});
