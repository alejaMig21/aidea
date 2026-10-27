import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { request } from "node:http";
import { fileURLToPath } from "node:url";
import { startCore } from "../src/core/server.ts";
import type { CoreNode } from "../src/core/server.ts";

const fixture = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

let core: Awaited<ReturnType<typeof startCore>>;
before(async () => {
  core = await startCore({ port: 0 });
});
after(() => core.close());

const post = (path: string, body: unknown) =>
  fetch(core.url + path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

// Raw request, so tests can set headers such as Host and Origin that fetch controls itself.
const raw = (method: string, path: string, headers: Record<string, string>, body?: string) =>
  new Promise<{ status: number; text: string }>((resolve, reject) => {
    const { port } = new URL(core.url);
    const req = request({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      let text = "";
      res.on("data", (c) => (text += c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
    });
    req.on("error", reject);
    req.end(body);
  });

test("opening a Python Project returns Nodes for its modules, classes and functions", async () => {
  const res = await post("/projects", { path: fixture("shop") });
  assert.equal(res.status, 201);
  const project = await res.json();

  const summary = project.nodes.map((n: CoreNode) => `${n.kind} ${n.id}`).sort();
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

  const add = project.nodes.find((n: CoreNode) => n.id === "cart.Cart.add");
  assert.equal(add.parent, "cart.Cart");
});

test("an opened Project appears in the Projects list", async () => {
  await post("/projects", { path: fixture("shop") });
  const list = await (await fetch(core.url + "/projects")).json();
  assert.deepEqual(
    list.find((p: { path: string }) => p.path === fixture("shop")),
    { id: fixture("shop"), name: "shop", path: fixture("shop") },
  );
});

test("two Projects whose folders share a name stay separate", async () => {
  await post("/projects", { path: fixture("twins/a/app") });
  await post("/projects", { path: fixture("twins/b/app") });
  const list = await (await fetch(core.url + "/projects")).json();
  const apps = list.filter((p: { name: string }) => p.name === "app");
  assert.equal(apps.length, 2);
});

test("a file that does not parse is reported and the rest of the Project still opens", async () => {
  const project = await (await post("/projects", { path: fixture("broken") })).json();
  assert.deepEqual(
    project.nodes.map((n: CoreNode) => n.id).sort(),
    ["ok", "ok.fine"],
  );
  assert.equal(project.errors.length, 1);
  assert.equal(project.errors[0].file, "bad.py");
});

test("a path that is not an existing directory is rejected with a clear message", async () => {
  const res = await post("/projects", { path: fixture("shop") + "/does-not-exist" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /existing directory/);
});

test("a request body above the size limit is rejected", async () => {
  const res = await post("/projects", { path: "x".repeat(70 * 1024) });
  assert.equal(res.status, 413);
});

test("a request from a foreign Origin is rejected", async () => {
  const res = await raw("POST", "/projects", { "content-type": "application/json", origin: "http://evil.example" }, JSON.stringify({ path: fixture("shop") }));
  assert.equal(res.status, 403);
});

test("a request with a foreign Host header is rejected", async () => {
  const res = await raw("GET", "/projects", { host: "evil.example" });
  assert.equal(res.status, 403);
});
