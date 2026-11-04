import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startCore } from "../src/core/server.ts";

// The channel between the two halves of a plugin: the host half answers named calls, the interface half makes them.
const scratch = mkdtempSync(join(tmpdir(), "aidea-channel-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

const MAIN = `export function activate(ctx) {
  ctx.api.handle("echo", (body) => ({ got: body, from: ctx.plugin.id }));
  ctx.api.handle("boom", () => { throw new Error("it broke"); });
}`;
let n = 0;
async function start() {
  const store = join(scratch, `s${n++}`);
  for (const id of ["fixture.a", "fixture.b"]) {
    mkdirSync(join(store, id), { recursive: true });
    writeFileSync(join(store, id, "aidea-plugin.json"), JSON.stringify({ id, version: "1.0.0", title: id, description: "x", publisher: "t", api: "0.1", main: "main.js" }));
    writeFileSync(join(store, id, "main.js"), MAIN);
  }
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
  const call = async (id: string, name: string, body: unknown = {}, method = "POST") => {
    const r = await fetch(`${core.url}/plugins/${id}/call/${name}`, { method, headers: { "content-type": "application/json" }, body: method === "POST" ? JSON.stringify(body) : undefined });
    return { status: r.status, body: (await r.json()) as any };
  };
  return { core, call };
}

test("a named call reaches the plugin's own handler and returns its answer", async () => {
  const t = await start();
  try {
    const r = await t.call("fixture.a", "echo", { x: 1 });
    assert.deepEqual([r.status, r.body], [200, { got: { x: 1 }, from: "fixture.a" }]);
    assert.equal((await t.call("fixture.b", "echo")).body.from, "fixture.b", "each plugin has its own handlers");
  } finally { t.core.close(); }
});

test("an unknown plugin or call is 404, a handler that throws is 500 with its message, GET is refused", async () => {
  const t = await start();
  try {
    assert.equal((await t.call("nobody", "echo")).status, 404);
    assert.equal((await t.call("fixture.a", "missing")).status, 404);
    const boom = await t.call("fixture.a", "boom");
    assert.deepEqual([boom.status, boom.body.error], [500, "it broke"]);
    assert.equal((await t.call("fixture.a", "echo", {}, "GET")).status, 405);
  } finally { t.core.close(); }
});

test("switching the plugin off removes its handlers", async () => {
  const t = await start();
  try {
    await fetch(`${t.core.url}/plugins/disable`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: "fixture.a" }) });
    assert.equal((await t.call("fixture.a", "echo")).status, 404);
    assert.equal((await t.call("fixture.b", "echo")).status, 200);
  } finally { t.core.close(); }
});
