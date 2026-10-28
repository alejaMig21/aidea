import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const scratch: string[] = [];
before(async () => {
  t = await startTestCore();
});
after(() => {
  t.core.close();
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

type R = { id: string; x: number; y: number; width: number; height: number };
type Route = { from: string; to: string; points: { x: number; y: number }[]; label?: { text: string; x: number; y: number }; technology?: string };
type Drawing = { rects: R[]; groups: R[]; routes: Route[]; texts: Record<string, { sub: string; lines: string[]; title: string }> };

const why = { why: "because", rejected: [] };
const nodes = [
  { id: "designer", title: "Designer", technology: "Browser", kind: "person", description: "Builds a quote for a customer.", relations: [{ to: "web-app", label: "Builds quotes with", technology: "HTTPS" }], rationale: why },
  { id: "studio", title: "Studio", technology: "Python", kind: "system", description: "Everything we build for quoting.", rationale: why },
  { id: "web-app", title: "Web app", technology: "Python + Flask", kind: "container", parent: "studio", description: "Serves the quote form and prices a quote, then keeps the customer informed.", relations: [{ to: "quote-db", label: "Reads and writes quotes", technology: "SQL" }, { to: "mailer", label: "Sends the quote by email" }], rationale: why },
  { id: "quote-db", title: "Quote database", technology: "SQLite", kind: "container", parent: "studio", description: "Stores every quote.", rationale: why },
  { id: "mailer", title: "Mail service", technology: "SMTP", kind: "system", description: "External service that delivers email.", rationale: why },
  { id: "odd", title: "Odd one", technology: "Unknown thing", rationale: why },
];

async function open(list: unknown[]) {
  const dir = mkdtempSync(join(tmpdir(), "aidea-arch-"));
  scratch.push(dir);
  mkdirSync(join(dir, ".aidea"));
  writeFileSync(join(dir, ".aidea", "architecture.json"), JSON.stringify({ nodes: list }));
  await t.post("/projects", { path: dir });
  return dir;
}
const drawing = async (dir: string, layer = "architecture") =>
  (await (await t.get(`/layout?project=${encodeURIComponent(dir)}&layer=${layer}`)).json()) as Drawing;
const overlap = (a: R, b: R) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
const inside = (a: R, box: R) => a.x >= box.x && a.y >= box.y && a.x + a.width <= box.x + box.width && a.y + a.height <= box.y + box.height;

test("children sit inside their parent's boundary with a margin; roots stay outside it", async () => {
  const d = await drawing(await open(nodes));
  const at = new Map(d.rects.map((r) => [r.id, r]));
  const box = d.groups.find((g) => g.id === "studio")!;
  assert.ok(box, "the system with children has a boundary box");
  assert.deepEqual(box, at.get("studio")); // a Node's rect is its box, so traces and focus find it
  for (const id of ["web-app", "quote-db"]) {
    const r = at.get(id)!;
    assert.ok(r.x - box.x >= 20 && r.y - box.y >= 20 && box.x + box.width - (r.x + r.width) >= 20 && box.y + box.height - (r.y + r.height) >= 20, `${id} keeps a margin`);
  }
  for (const id of ["designer", "mailer", "odd"]) assert.ok(!overlap(at.get(id)!, box), `${id} is outside the boundary`);
  assert.equal(d.groups.length, 1);
});

test("no two elements overlap and the same project gives identical results", async () => {
  const dir = await open(nodes);
  const a = await drawing(dir);
  assert.deepEqual(await drawing(dir), a);
  const leaves = a.rects.filter((r) => !a.groups.some((g) => g.id === r.id));
  for (const x of leaves) for (const y of leaves) if (x !== y) assert.ok(!overlap(x, y), `${x.id} overlaps ${y.id}`);
  assert.equal(leaves.length, 5);
});

test("an element is sized to fit its name, [kind: technology] and wrapped description", async () => {
  const d = await drawing(await open(nodes));
  const at = new Map(d.rects.map((r) => [r.id, r]));
  assert.equal(d.texts["web-app"].sub, "[Container: Python + Flask]");
  assert.equal(d.texts["designer"].sub, "[Person]");
  assert.equal(d.texts["mailer"].sub, "[External System: SMTP]");
  assert.equal(d.texts["odd"].sub, "[Unknown thing]"); // no kind: a generic box
  assert.equal(d.texts["studio"].title, "Studio [Software System]");
  assert.ok(d.texts["web-app"].lines.length > 1, "a long description wraps");
  assert.ok(d.texts["web-app"].lines.every((l) => l.length <= 40));
  assert.equal(d.texts["web-app"].lines.join(" "), nodes[2].description);
  assert.ok(at.get("web-app")!.height > at.get("quote-db")!.height, "more description lines, taller box");
  assert.ok(at.get("web-app")!.width >= "[Container: Python + Flask]".length * 6.6 + 24);
});

test("every relation comes back as an orthogonal route with a label position and its technology", async () => {
  const d = await drawing(await open(nodes));
  assert.deepEqual(d.routes.map((r) => `${r.from}>${r.to}`), ["designer>web-app", "web-app>quote-db", "web-app>mailer"]);
  const at = new Map(d.rects.map((r) => [r.id, r]));
  for (const r of d.routes) {
    assert.ok(r.points.length >= 2);
    r.points.slice(1).forEach((p, i) => assert.ok(p.x === r.points[i].x || p.y === r.points[i].y, `${r.from}>${r.to} is orthogonal`));
    assert.ok(r.label && typeof r.label.x === "number" && typeof r.label.y === "number", "label position");
    const [a, b] = [at.get(r.from)!, at.get(r.to)!];
    const first = r.points[0], last = r.points[r.points.length - 1];
    assert.ok(first.x >= a.x && first.x <= a.x + a.width && first.y >= a.y && first.y <= a.y + a.height + 1, "starts on the source");
    assert.ok(last.x >= b.x && last.x <= b.x + b.width && last.y >= b.y - 1 && last.y <= b.y + b.height + 1, "ends on the target");
  }
  assert.deepEqual(d.routes.map((r) => [r.label!.text, r.technology]), [["Builds quotes with", "HTTPS"], ["Reads and writes quotes", "SQL"], ["Sends the quote by email", undefined]]);
});

test("labels of neighbouring relations do not cover each other", async () => {
  const d = await drawing(await open(nodes));
  const box = (r: Route): R => ({ id: r.from, x: r.label!.x, y: r.label!.y - 12, width: Math.max(r.label!.text.length, (r.technology?.length ?? 0) + 2) * 6.2, height: r.technology ? 28 : 16 });
  const boxes = d.routes.map(box);
  for (const a of boxes) for (const b of boxes) if (a !== b) assert.ok(!overlap(a, b), `labels of ${a.id} collide`);
});

test("a relation to a boundary ends on the box, not inside it", async () => {
  const list = [nodes[0], nodes[1], nodes[2], nodes[3]].map((n) => (n.id === "designer" ? { ...n, relations: [{ to: "studio", label: "Uses" }] } : n));
  const d = await drawing(await open(list));
  const box = d.groups[0];
  const last = d.routes[0].points.at(-1)!;
  assert.ok(Math.abs(last.y - box.y) < 1 || Math.abs(last.x - box.x) < 1 || Math.abs(last.x - (box.x + box.width)) < 1 || Math.abs(last.y - (box.y + box.height)) < 1, "ends on the box edge");
});

test("layers without parent or relations keep their layout and carry no boundaries", async () => {
  await t.post("/projects", { path: fixture("studio-c4") });
  const b = await drawing(fixture("studio-c4"), "business");
  assert.equal((b as unknown as Record<string, unknown>).groups, undefined);
  assert.equal((b as unknown as Record<string, unknown>).routes, undefined);
  assert.deepEqual([b.rects[0].x, b.rects[0].y, b.rects[0].width, b.rects[0].height], [0, 0, 240, 64]);
});

// The builder is a stand-in that makes the given tool calls over MCP, as in test/proposals.test.ts.
let script: { name: string; arguments: unknown }[] = [];
const asBuilder: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ permission }): AsyncGenerator<AgentEvent> {
    const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
    let id = 1;
    const rpc = (method: string, params: unknown) =>
      fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) }).then((r) => r.json());
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } });
    for (const call of script) yield { type: "text", text: JSON.stringify(await rpc("tools/call", call)) };
  },
};

test("a Proposal that adds a child previews inside the boundary, and one that adds a relation previews its arrow", async () => {
  const dir = await open(nodes);
  const core = await startCore({ port: 0, adapter: asBuilder });
  try {
    const cache = { id: "cache", title: "Cache", technology: "Redis", kind: "container", parent: "studio", description: "Keeps quotes fast.", rationale: why };
    const relations = [...nodes[2].relations!, { to: "cache", label: "Invalidates", technology: "Redis protocol" }];
    script = [
      { name: "propose_add_node", arguments: { layer: "architecture", node: cache } },
      { name: "propose_update_node", arguments: { layer: "architecture", id: "web-app", changes: { relations } } },
    ];
    const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    await post("/projects", { path: dir });
    await (await post("/chat", { project: dir, message: "propose" })).text();
    const body = (await (await fetch(`${core.url}/proposals?project=${encodeURIComponent(dir)}`)).json()) as { proposals: { nodeId: string; rect: R }[]; previews: { architecture: Drawing } };
    assert.equal(body.proposals.length, 2);
    const preview = body.previews.architecture;
    const box = preview.groups.find((g) => g.id === "studio")!;
    const place = body.proposals.find((p) => p.nodeId === "cache")!.rect;
    assert.ok(place && inside(place, box), "the new child is inside the studio boundary");
    assert.deepEqual(place, preview.rects.find((r) => r.id === "cache"));
    assert.ok(preview.routes.some((r) => r.from === "web-app" && r.to === "cache" && r.label!.text === "Invalidates"), "the proposed relation has a route");
    for (const x of preview.rects) for (const y of preview.rects) if (x !== y && x.id !== "studio" && y.id !== "studio") assert.ok(!overlap(x, y), `${x.id} overlaps ${y.id}`);
    assert.equal((await drawing(dir)).rects.some((r) => r.id === "cache"), false); // nothing was written
  } finally {
    core.close();
  }
});
