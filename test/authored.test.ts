import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
before(async () => {
  t = await startTestCore();
});
after(() => t.core.close());

const authored = (path: string) => t.get(`/authored?project=${encodeURIComponent(path)}`);

test("files in .aidea/ appear as Nodes on the Business, Requirements and Architecture Layers with their Rationale", async () => {
  await t.post("/projects", { path: fixture("studio") });
  const res = await authored(fixture("studio"));
  assert.equal(res.status, 200);
  const body = await res.json();

  assert.deepEqual(body.errors, []);
  assert.deepEqual(
    Object.keys(body.layers).sort(),
    ["architecture", "business", "requirements"],
  );
  for (const layer of Object.values<any>(body.layers)) assert.deepEqual(layer.errors, []);

  assert.deepEqual(body.layers.business.nodes, [
    {
      id: "vp-fast-quotes",
      title: "Quotes in minutes",
      block: "value propositions",
      rationale: {
        why: "Small shops lose deals while waiting days for a quote.",
        rejected: [{ option: "Phone-only quotes", reason: "Does not scale past one salesperson." }],
      },
    },
  ]);
  assert.deepEqual(body.layers.requirements.nodes.map((n: any) => [n.id, n.as, n.want, n.so]), [
    ["us-request-quote", "shop owner", "to request a quote from a form", "I get a price without calling"],
  ]);
  assert.deepEqual(
    body.layers.architecture.nodes.map((n: any) => [n.id, n.technology, n.parent ?? null]),
    [
      ["web-app", "Python + Flask", null],
      ["quote-db", "SQLite", "web-app"],
    ],
  );
  assert.equal(body.layers.architecture.nodes[0].rationale.rejected[0].option, "Node + Express");
});

test("a malformed hand edit is reported by file and problem, and valid Nodes and files still load", async () => {
  await t.post("/projects", { path: fixture("studio-bad") });
  const res = await authored(fixture("studio-bad"));
  assert.equal(res.status, 200);
  const body = await res.json();

  // Invalid JSON: reported against its file, the layer is empty.
  assert.deepEqual(body.layers.business.nodes, []);
  assert.equal(body.layers.business.errors.length, 1);
  assert.equal(body.layers.business.errors[0].file, ".aidea/business.json");
  assert.match(body.layers.business.errors[0].message, /not valid JSON/);

  // A valid file next to a broken one is unaffected.
  assert.deepEqual(body.layers.requirements.nodes.map((n: any) => n.id), ["us-1"]);
  assert.deepEqual(body.layers.requirements.errors, []);

  // Bad Nodes are dropped one by one; good ones stay.
  assert.deepEqual(body.layers.architecture.nodes.map((n: any) => n.id), ["db", "ok"]);
  assert.deepEqual(body.layers.architecture.errors, [
    { file: ".aidea/architecture.json", message: 'nodes[1]: duplicate id "db"' },
    { file: ".aidea/architecture.json", message: 'nodes[2]: "technology" must be a non-empty string' },
    { file: ".aidea/architecture.json", message: 'nodes[3]: "rationale.rejected[0].reason" must be a non-empty string' },
  ]);

  // A file that is not one of the known Layers is reported, not ignored.
  assert.deepEqual(body.errors, [
    { file: ".aidea/notes.json", message: "unknown layer file (expected business, requirements or architecture)" },
  ]);
});

test("a Project without a .aidea folder has empty Layers and no errors", async () => {
  await t.post("/projects", { path: fixture("shop") });
  const body = await (await authored(fixture("shop"))).json();
  assert.deepEqual(body.errors, []);
  for (const name of ["business", "requirements", "architecture"]) {
    assert.deepEqual(body.layers[name], { nodes: [], errors: [] });
  }
});

test("requests for an unopened Project or without a project parameter get a 4xx error", async () => {
  assert.equal((await authored(fixture("twins"))).status, 404);
  assert.equal((await t.get("/authored")).status, 400);
  assert.equal((await t.get("/authored?project=..%2F..%2Fetc")).status, 404);
});
