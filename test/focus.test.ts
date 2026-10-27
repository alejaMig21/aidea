import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

const traced = fixture("traced");
const q = (project: string, extra = "") => `project=${encodeURIComponent(project)}${extra}`;
const focus = (project: string, layer: string, node: string) => t.post("/focus", { project, layer, node });
const copyOfTraced = () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-focus-"));
  scratch.push(dir);
  cpSync(traced, dir, { recursive: true });
  return dir;
};

test("each layer has a layout computed by the core", async () => {
  await t.post("/projects", { path: traced });
  const res = await t.get(`/layout?${q(traced, "&layer=architecture")}`);
  assert.equal(res.status, 200);
  const { rects } = await res.json();
  assert.deepEqual(rects.slice(0, 2), [
    { id: "checkout", x: 0, y: 0, width: 240, height: 64 },
    { id: "ledger", x: 280, y: 0, width: 240, height: 64 },
  ]);
  assert.deepEqual(rects.map((r: { id: string }) => r.id), ["checkout", "ledger", "lonely"]);
});

test("Trace links are listed from each authored layer to the layer below", async () => {
  await t.post("/projects", { path: traced });
  const { links } = await (await t.get(`/traces?${q(traced)}`)).json();
  assert.deepEqual(links, [
    { layer: "business", from: "b1", to: "r1", broken: false },
    { layer: "requirements", from: "r1", to: "checkout", broken: false },
    { layer: "architecture", from: "checkout", to: "orders.place", broken: false },
    { layer: "architecture", from: "checkout", to: "billing.charge", broken: false },
    { layer: "architecture", from: "ledger", to: "billing.charge", broken: false },
  ]);
});

test("zooming into a Node returns a framing centered on its Footprint", async () => {
  await t.post("/projects", { path: traced });
  const res = await focus(traced, "architecture", "ledger");
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.layer, "components");
  assert.deepEqual(body.origin, { layer: "architecture", node: "ledger" });
  assert.deepEqual(body.parts, ["billing.charge"]);
  // billing.charge sits at x=18, y=36 and is 222 wide and 28 high; the framing adds 24 of margin on every side.
  assert.deepEqual(body.frame, { x: -6, y: 12, width: 270, height: 76 });
});

test("a Footprint with several separate parts is framed as a whole and the rest is dimmed", async () => {
  await t.post("/projects", { path: traced });
  const body = await (await focus(traced, "architecture", "checkout")).json();
  assert.deepEqual(body.parts, ["billing.charge", "orders.place"]);
  // billing.charge ends at x=240; orders.place starts at x=298 and ends at x=520.
  assert.deepEqual(body.frame, { x: -6, y: 12, width: 550, height: 76 });
  assert.ok(body.dimmed.includes("billing") && body.dimmed.includes("orders"));
  assert.ok(!body.dimmed.includes("billing.charge") && !body.dimmed.includes("orders.place"));
});

test("zooming out returns to the Node the person came from", async () => {
  await t.post("/projects", { path: traced });
  await focus(traced, "architecture", "checkout");
  const res = await t.post("/focus/out", { project: traced });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.layer, "architecture");
  assert.equal(body.node, "checkout");
  // checkout is the first Node of its layer: x=0, y=0, 240 by 64, plus 24 of margin.
  assert.deepEqual(body.frame, { x: -24, y: -24, width: 288, height: 112 });
  // The interface hides its zoom-out control when no earlier Node is left to return to.
  assert.equal(body.remaining, 0);
  // Nothing is left to zoom out from.
  assert.equal((await t.post("/focus/out", { project: traced })).status, 409);
});

test("deleting a function and refreshing marks the Trace links that pointed to it as Broken links", async () => {
  const dir = copyOfTraced();
  await t.post("/projects", { path: dir });
  writeFileSync(join(dir, "billing.py"), "def refund():\n    return 3\n");
  await t.post("/projects", { path: dir }); // reopening refreshes the derived layers
  const { links } = await (await t.get(`/traces?${q(dir)}`)).json();
  const broken = links.filter((l: { broken: boolean }) => l.broken).map((l: { from: string; to: string }) => `${l.from}->${l.to}`);
  assert.deepEqual(broken, ["checkout->billing.charge", "ledger->billing.charge"]);

  const body = await (await focus(dir, "architecture", "checkout")).json();
  assert.deepEqual(body.parts, ["orders.place"]);
  assert.deepEqual(body.broken, ["billing.charge"]);
});

test("zooming in is refused with a clear message when there is nothing to follow", async () => {
  await t.post("/projects", { path: traced });
  const none = await focus(traced, "architecture", "lonely");
  assert.equal(none.status, 422);
  assert.match((await none.json()).error, /no Trace links/);
  assert.equal((await focus(traced, "architecture", "nope")).status, 404);
  assert.equal((await focus(traced, "components", "orders")).status, 400);
  assert.equal((await focus(traced + "-never-opened", "architecture", "checkout")).status, 404);
  assert.equal((await t.post("/focus", { project: traced })).status, 400);
});

test("a Trace links field that is not a list of ids is reported as a mistake in the file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-traces-"));
  scratch.push(dir);
  writeFileSync(join(dir, "app.py"), "def run():\n    return 1\n");
  mkdirSync(join(dir, ".aidea"));
  writeFileSync(
    join(dir, ".aidea", "architecture.json"),
    JSON.stringify({ nodes: [{ id: "web", title: "Web", technology: "Flask", traces: "app.run", rationale: { why: "x", rejected: [] } }] }),
  );
  await t.post("/projects", { path: dir });
  const body = await (await t.get(`/authored?${q(dir)}`)).json();
  assert.deepEqual(body.layers.architecture.nodes, []);
  assert.match(body.layers.architecture.errors[0].message, /traces/);
});
