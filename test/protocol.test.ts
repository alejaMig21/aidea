import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { CoreNode } from "../src/core/types.ts";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
before(async () => {
  t = await startTestCore();
});
after(() => t.core.close());

test("opening a Python Project returns Nodes for its modules, classes and functions", async () => {
  const res = await t.post("/projects", { path: fixture("shop") });
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
  await t.post("/projects", { path: fixture("shop") });
  const list = await (await t.get("/projects")).json();
  assert.deepEqual(
    list.find((p: { path: string }) => p.path === fixture("shop")),
    { id: fixture("shop"), name: "shop", path: fixture("shop") },
  );
});

test("two Projects whose folders share a name stay separate", async () => {
  await t.post("/projects", { path: fixture("twins/a/app") });
  await t.post("/projects", { path: fixture("twins/b/app") });
  const list = await (await t.get("/projects")).json();
  const apps = list.filter((p: { name: string }) => p.name === "app");
  assert.equal(apps.length, 2);
});

test("a file that does not parse is reported and the rest of the Project still opens", async () => {
  const project = await (await t.post("/projects", { path: fixture("broken") })).json();
  assert.deepEqual(
    project.nodes.map((n: CoreNode) => n.id).sort(),
    ["ok", "ok.fine"],
  );
  assert.equal(project.errors.length, 1);
  assert.equal(project.errors[0].file, "bad.py");
});

test("a path that is not an existing directory is rejected with a clear message", async () => {
  const res = await t.post("/projects", { path: fixture("shop") + "/does-not-exist" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /not an existing folder/);
});

test("a request body above the size limit is rejected", async () => {
  const res = await t.post("/projects", { path: "x".repeat(70 * 1024) });
  assert.equal(res.status, 413);
});

test("a request from a foreign Origin is rejected", async () => {
  const res = await t.raw("POST", "/projects", { "content-type": "application/json", origin: "http://evil.example" }, JSON.stringify({ path: fixture("shop") }));
  assert.equal(res.status, 403);
});

test("a body that is not declared as JSON is refused with 415, so a cross-site form cannot send one", async () => {
  const body = JSON.stringify({ path: fixture("shop") });
  for (const headers of [{} as Record<string, string>, { "content-type": "text/plain" }, { "content-type": "application/x-www-form-urlencoded" }]) {
    const res = await t.raw("POST", "/projects", headers, body);
    assert.equal(res.status, 415, JSON.stringify(headers));
    assert.match(JSON.parse(res.text).error, /application\/json/);
  }
  assert.equal((await t.raw("POST", "/projects", { "content-type": "application/json; charset=utf-8" }, body)).status, 201);
});

test("a request with a foreign Host header is rejected", async () => {
  const res = await t.raw("GET", "/projects", { host: "evil.example" });
  assert.equal(res.status, 403);
});

test("the page is served with the interface features inlined", async () => {
  const res = await t.get("/");
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.ok(!html.includes("<!--features-->"));
  assert.match(html, /<script>/);
});

test("the interface fonts are served from the core with the font content type, and only those files", async () => {
  const font = await t.get("/fonts/inter-latin-wght-normal.woff2");
  assert.equal(font.status, 200);
  assert.equal(font.headers.get("content-type"), "font/woff2");
  assert.ok((await font.arrayBuffer()).byteLength > 10_000);

  assert.equal((await t.get("/fonts/OFL-Inter.txt")).status, 404);
  assert.equal((await t.get("/fonts/..%2Findex.html")).status, 404);
});
