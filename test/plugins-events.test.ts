import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startCore } from "../src/core/server.ts";

// Ticket plugin-system/12: a plugin defines events with its own name, a declared mode and a version; other plugins react to them without importing it.
const scratch = mkdtempSync(join(tmpdir(), "aidea-events-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));
const log = ((globalThis as any).__plugLog ??= [] as string[]) as string[];

const base = (id: string, extra: object = {}) => ({ id, version: "1.0.0", title: `Title of ${id}`, description: "A fixture.", publisher: "tests", api: "0.1", main: "main.js", ...extra });
let n = 0;
async function open(plugins: Record<string, { manifest: object; main: string }>) {
  const store = join(scratch, `store${n++}`);
  for (const [folder, p] of Object.entries(plugins)) {
    mkdirSync(join(store, folder), { recursive: true });
    writeFileSync(join(store, folder, "aidea-plugin.json"), JSON.stringify(p.manifest));
    writeFileSync(join(store, folder, "main.js"), p.main);
  }
  mkdirSync(store, { recursive: true });
  const core = await startCore({ port: 0, pluginsDir: store, builtinPluginsDir: false });
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { core, post, list: async () => (await (await fetch(core.url + "/plugins")).json()) as any };
}
const A = base("fixture.a", { events: { went: { mode: "announce", version: 1 }, "can-it": { mode: "ask", version: 2 } } });
const A_MAIN = `export function activate(ctx) {
  const L = globalThis.__plugLog;
  ctx.services.provide("fixture.a.fire", (what, data) => {
    try {
      if (what === "ask") return ctx.ask("can-it", data);
      if (what === "ask-announce") return ctx.ask("went", data);
      if (what === "emit-ask") return ctx.emit("can-it", data);
      return ctx.emit(what, data);
    } catch (e) { L.push("a threw: " + e.message); }
  });
}`;
const fire = async (t: Awaited<ReturnType<typeof open>>, what: string, data: unknown = { n: 1 }) => {
  // the fixture offers a service; the test reaches it through a second fixture plugin that calls it on activation of a flag file is overkill, so the core exposes the service map to tests
  return (t.core as any).plugins.callService("fixture.a.fire", what, data);
};

test("a plugin announces an event; another plugin reacts to it by its full name, and gets a copy of the data", async () => {
  const t = await open({
    a: { manifest: A, main: A_MAIN },
    b: { manifest: base("fixture.b"), main: `export function activate(ctx) { ctx.on("fixture.a/went", (data) => { data.n = 99; globalThis.__plugLog.push("b heard " + JSON.stringify(data)); }); ctx.on("fixture.a/went", () => { throw new Error("one listener fails"); }); ctx.on("fixture.a/went", (data) => globalThis.__plugLog.push("c heard n=" + data.n)); }` },
  });
  try {
    log.length = 0;
    await fire(t, "went", { n: 1 });
    assert.deepEqual(log, ['b heard {"n":99}', "c heard n=1"], "each listener gets its own copy; a failing listener does not stop the rest");
  } finally { t.core.close(); }
});

test("a plugin cannot emit an event its manifest did not declare, nor one in another plugin's namespace, nor ask on an announce event", async () => {
  const t = await open({
    a: { manifest: A, main: A_MAIN },
    b: { manifest: base("fixture.b", { events: { mine: { mode: "announce", version: 1 } } }), main: `export function activate(ctx) { ctx.services.provide("fixture.b.fire", (what) => { try { ctx.emit(what, {}); } catch (e) { globalThis.__plugLog.push("b threw: " + e.message); } }); }` },
  });
  try {
    log.length = 0;
    await fire(t, "not-declared");
    await fire(t, "emit-ask");
    await fire(t, "ask-announce");
    (t.core as any).plugins.callService("fixture.b.fire", "fixture.a/went");
    assert.equal(log.length, 4, JSON.stringify(log));
    assert.match(log[0], /a threw: .*not-declared/);
    assert.match(log[1], /a threw: .*can-it/);
    assert.match(log[2], /a threw: .*went/);
    assert.match(log[3], /b threw: .*namespace|b threw: .*fixture\.a/);
  } finally { t.core.close(); }
});

test("an event that can ask collects answers: only deny and ask count, any deny wins, and an allow is ignored", async () => {
  const t = await open({
    a: { manifest: A, main: A_MAIN },
    b: { manifest: base("fixture.b"), main: `export function activate(ctx) { ctx.on("fixture.a/can-it", () => ({ decision: "allow" })); }` },
  });
  try {
    assert.deepEqual(await fire(t, "ask"), { decision: "allow" }, "nobody objected");
  } finally { t.core.close(); }
  const u = await open({
    a: { manifest: A, main: A_MAIN },
    b: { manifest: base("fixture.b"), main: `export function activate(ctx) { ctx.on("fixture.a/can-it", () => ({ decision: "ask", question: "sure?" })); }` },
    c: { manifest: base("fixture.c"), main: `export function activate(ctx) { ctx.on("fixture.a/can-it", () => ({ decision: "deny", reason: "no" })); ctx.on("fixture.a/can-it", () => ({ decision: "allow" })); }` },
  });
  try {
    const answer = await fire(u, "ask");
    assert.equal(answer.decision, "deny");
    assert.match(answer.reason, /no/);
  } finally { u.core.close(); }
  const v = await open({
    a: { manifest: A, main: A_MAIN },
    b: { manifest: base("fixture.b"), main: `export function activate(ctx) { ctx.on("fixture.a/can-it", () => ({ decision: "ask", question: "sure?" })); }` },
  });
  try {
    assert.deepEqual(await fire(v, "ask"), { decision: "ask", question: "sure?" });
  } finally { v.core.close(); }
});

test("deactivating a plugin removes its listeners and its events", async () => {
  const t = await open({
    a: { manifest: A, main: A_MAIN },
    b: { manifest: base("fixture.b"), main: `export function activate(ctx) { ctx.on("fixture.a/went", () => globalThis.__plugLog.push("b heard")); }` },
  });
  try {
    log.length = 0;
    await t.post("/plugins/deactivate", { id: "fixture.b" });
    await fire(t, "went");
    assert.deepEqual(log, [], "a deactivated plugin hears nothing");
    const events = (await t.list()).events as { name: string }[];
    assert.deepEqual(events.map((e) => e.name).sort(), ["fixture.a/can-it", "fixture.a/went"]);
    await t.post("/plugins/deactivate", { id: "fixture.a" });
    assert.deepEqual((await t.list()).events, []);
  } finally { t.core.close(); }
});

test("the events are listed with their owner, mode and version", async () => {
  const t = await open({ a: { manifest: A, main: A_MAIN } });
  try {
    assert.deepEqual((await t.list()).events, [
      { name: "fixture.a/can-it", owner: "fixture.a", mode: "ask", version: 2 },
      { name: "fixture.a/went", owner: "fixture.a", mode: "announce", version: 1 },
    ]);
  } finally { t.core.close(); }
});
