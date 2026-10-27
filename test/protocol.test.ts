import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { startCore } from "../src/core/server.ts";

const fixture = fileURLToPath(new URL("./fixtures/shop", import.meta.url));

let core: Awaited<ReturnType<typeof startCore>>;
before(async () => {
  core = await startCore({ port: 0 });
});
after(() => core.close());

const post = (path: string, body: unknown) =>
  fetch(core.url + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

test("opening a Python Project returns Nodes for its modules, classes and functions", async () => {
  const res = await post("/projects", { path: fixture });
  assert.equal(res.status, 201);
  const project = await res.json();

  const summary = project.nodes
    .map((n: { kind: string; id: string }) => `${n.kind} ${n.id}`)
    .sort();
  assert.deepEqual(summary, [
    "class cart.Cart",
    "function cart.Cart.__init__",
    "function cart.Cart.add",
    "function cart.Cart.total",
    "function cart.apply_discount",
    "function main.run",
    "module cart",
    "module main",
  ]);

  const add = project.nodes.find((n: { id: string }) => n.id === "cart.Cart.add");
  assert.equal(add.parent, "cart.Cart");
});

test("an opened Project appears in the Projects list", async () => {
  await post("/projects", { path: fixture });
  const list = await (await fetch(core.url + "/projects")).json();
  assert.deepEqual(list, [{ id: "shop", name: "shop", path: fixture }]);
});

test("a path that is not an existing directory is rejected with a clear message", async () => {
  const res = await post("/projects", { path: fixture + "/does-not-exist" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /existing directory/);
});
