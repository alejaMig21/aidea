import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer, connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// The Run plugin (run-and-terminal 04 to 07): the run recipe, the person's consent, Play, the output, Stop and restart, with tiny real child processes.
const scratch = mkdtempSync(join(tmpdir(), "aidea-run-"));
const cores: { close(): void }[] = [];
after(() => { for (const c of cores) c.close(); rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }); });

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const freePort = () => new Promise<number>((res) => { const s = createServer().listen(0, "127.0.0.1", () => { const p = (s.address() as any).port; s.close(() => res(p)); }); });
const answers = (port: number) => new Promise<boolean>((res) => { const c = connect(port, "127.0.0.1"); c.on("connect", () => { c.destroy(); res(true); }); c.on("error", () => res(false)); });
const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

let n = 0;
async function setup(recipe?: unknown, scripts: Record<string, string> = {}, store = join(scratch, `store${n++}`)) {
  const project = join(scratch, `project${n++}`);
  cpSync(fixture("shop"), project, { recursive: true });
  for (const [f, t] of Object.entries(scripts)) { mkdirSync(join(project, f, ".."), { recursive: true }); writeFileSync(join(project, f), t); }
  const write = (r: unknown) => { mkdirSync(join(project, ".aidea"), { recursive: true }); writeFileSync(join(project, ".aidea", "run.json"), typeof r === "string" ? r : JSON.stringify(r)); };
  if (recipe !== undefined) write(recipe);
  mkdirSync(store, { recursive: true });
  const boot = async () => {
    const core = await startCore({ port: 0, pluginsDir: store });
    cores.push(core);
    const id = ((await (await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) })).json()) as any).id;
    const call = async (name: string, body: object = {}) => { const r = await fetch(`${core.url}/plugins/run/call/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ project: id, ...body }) }); return { status: r.status, body: (await r.json()) as any }; };
    return { core, id, call };
  };
  return { project, write, boot, store };
}
const part = (name: string, command: string, extra: object = {}) => ({ name, command, ...extra });
const output = async (t: any, name: string) => (await t.call("output")).body.parts.find((p: any) => p.name === name);
const until = async (cond: () => Promise<boolean> | boolean, ms = 8000) => { for (let t = 0; t < ms; t += 50) { if (await cond()) return true; await wait(50); } return false; };

test("with no recipe, the status says there is none", async () => {
  const s = await setup();
  const t = await s.boot();
  const r = await t.call("status");
  assert.equal(r.body.recipe.state, "none");
  assert.deepEqual((await t.call("play")).body, { started: false, reason: "no-recipe" });
});

test("a recipe with a bad field is refused with a message that names the field", async () => {
  const cases: [unknown, RegExp][] = [
    ["{not json", /not valid JSON/],
    [{ parts: [] }, /parts/],
    [{ parts: [{ command: "x" }] }, /parts\[0\]\.name/],
    [{ parts: [{ name: "a" }] }, /parts\[0\]\.command/],
    [{ parts: [part("a", "x", { folder: "../out" })] }, /parts\[0\]\.folder/],
    [{ parts: [part("a", "x", { waitFor: ["ghost"] })] }, /parts\[0\]\.waitFor.*ghost/],
    [{ parts: [part("a", "x", { ready: { port: "x" } })] }, /parts\[0\]\.ready/],
    [{ parts: [part("a", "x", { timeoutSeconds: -1 })] }, /parts\[0\]\.timeoutSeconds/],
    [{ parts: [part("a", "x"), part("a", "y")] }, /parts\[1\]\.name.*already/],
    [{ parts: [part("a", "x", { waitFor: ["b"] }), part("b", "y", { waitFor: ["a"] })] }, /cycle/i],
  ];
  for (const [recipe, pattern] of cases) {
    const t = await (await setup(recipe)).boot();
    const r = (await t.call("status")).body.recipe;
    assert.equal(r.state, "invalid");
    assert.match(r.errors.join(" | "), pattern);
  }
});

test("Play refuses a recipe the person has not accepted and shows the whole recipe; nothing starts", async () => {
  const s = await setup({ parts: [part("hello", "node hello.js")] }, { "hello.js": 'require("fs").writeFileSync("started.txt", "x"); console.log("hi");' });
  const t = await s.boot();
  const r = (await t.call("play")).body;
  assert.equal(r.started, false);
  assert.equal(r.reason, "needs-accept");
  assert.deepEqual(r.whole.parts.map((p: any) => p.name), ["hello"]);
  assert.equal(r.changes, undefined);
  await wait(500);
  assert.throws(() => readFileSync(join(s.project, "started.txt")));
  assert.equal((await t.call("output")).body.parts.length, 0);
});

test("accepting is remembered across a core restart on another port, and kept outside the project", async () => {
  const s = await setup({ parts: [part("hello", "node hello.js")] }, { "hello.js": 'console.log("hi");' });
  const first = await s.boot();
  await first.call("accept");
  first.core.close();
  const second = await s.boot();
  assert.notEqual(first.core.url, second.core.url);
  const r = (await second.call("play")).body;
  assert.equal(r.started, true, JSON.stringify(r));
  assert.throws(() => readFileSync(join(s.project, ".aidea", "accepted.json")));
});

test("a changed recipe asks again and shows only the difference", async () => {
  const s = await setup({ parts: [part("db", "node a.js"), part("api", "node a.js")] }, { "a.js": "setTimeout(() => {}, 100)" });
  const t = await s.boot();
  await t.call("accept");
  s.write({ parts: [part("db", "node a.js"), part("api", "node a.js --changed"), part("web", "node a.js")] });
  const r = (await t.call("play")).body;
  assert.equal(r.reason, "needs-accept");
  assert.equal(r.whole, undefined);
  assert.deepEqual(r.changes, { added: ["web"], removed: [], changed: ["api"] });
});

test("Play starts the part in its folder; its lines appear while it runs; the text stays after it exits with its code", async () => {
  const s = await setup({ parts: [part("hello", "node hello.js", { folder: "sub" })] }, { "sub/hello.js": 'console.log("line one"); console.error("err line"); setTimeout(() => process.exit(3), 600);' });
  const t = await s.boot();
  await t.call("accept");
  assert.equal((await t.call("play")).body.started, true);
  assert.ok(await until(async () => /line one/.test((await output(t, "hello"))?.lines.join("\n") ?? "")));
  assert.equal((await output(t, "hello")).alive, true);
  assert.ok(await until(async () => (await output(t, "hello")).alive === false));
  const done = await output(t, "hello");
  assert.deepEqual([done.exit, /line one/.test(done.lines.join("\n")), /err line/.test(done.lines.join("\n"))], [3, true, true]);
});

test("a very long output keeps the most recent lines and says how many were dropped", async () => {
  const s = await setup({ parts: [part("loud", "node loud.js")] }, { "loud.js": 'for (let i = 1; i <= 5000; i++) console.log("row " + i);' });
  const t = await s.boot();
  await t.call("accept");
  await t.call("play");
  assert.ok(await until(async () => (await output(t, "loud"))?.alive === false));
  const o = await output(t, "loud");
  assert.equal(o.lines.at(-1), "row 5000");
  assert.ok(o.dropped > 0 && o.lines.length + o.dropped === 5000, `${o.lines.length} + ${o.dropped}`);
});

test("Stop all ends a part that starts its own child and opens a port: no process and no port is left", async () => {
  const port = await freePort();
  const s = await setup({ parts: [part("tree", "node parent.js")] }, {
    "parent.js": `const { spawn } = require("child_process"); const c = spawn(process.execPath, ["child.js"], { stdio: "inherit" }); console.log("child " + c.pid); setInterval(() => {}, 1000);`,
    "child.js": `require("net").createServer().listen(${port}, "127.0.0.1", () => console.log("listening")); setInterval(() => {}, 1000);`,
  });
  const t = await s.boot();
  await t.call("accept");
  await t.call("play");
  assert.ok(await until(() => answers(port)));
  const childPid = Number(/child (\d+)/.exec((await output(t, "tree")).lines.join("\n"))![1]);
  assert.ok(alive(childPid));
  await t.call("stop");
  assert.ok(await until(async () => !(await answers(port)) && !alive(childPid)), "the grandchild and its port are gone");
  assert.equal((await output(t, "tree")).alive, false);
});

test("parts start in dependency order, each waiting for its ready signal (port, line, file, url)", async () => {
  const port = await freePort(), webPort = await freePort();
  const s = await setup({ parts: [
    part("web", "node web.js", { waitFor: ["api"], ready: { url: `http://127.0.0.1:${webPort}/` } }),
    part("api", "node api.js", { waitFor: ["cache", "db"], ready: { file: "api.ready" } }),
    part("cache", "node cache.js", { ready: { line: "cache is up" } }),
    part("db", "node db.js", { ready: { port } }),
  ] }, {
    "db.js": `setTimeout(() => require("net").createServer().listen(${port}, "127.0.0.1"), 700); setInterval(() => {}, 1000);`,
    "cache.js": `setTimeout(() => console.log("cache is up"), 500); setInterval(() => {}, 1000);`,
    "api.js": `require("fs").appendFileSync("order.txt", "api " + Date.now() + "\\n"); setTimeout(() => require("fs").writeFileSync("api.ready", "1"), 400); setInterval(() => {}, 1000);`,
    "web.js": `require("fs").appendFileSync("order.txt", "web " + Date.now() + "\\n"); require("http").createServer((q, r) => r.end("ok")).listen(${webPort}, "127.0.0.1"); setInterval(() => {}, 1000);`,
  });
  const t = await s.boot();
  await t.call("accept");
  const r = (await t.call("play")).body;
  assert.equal(r.started, true, JSON.stringify(r));
  const order = readFileSync(join(s.project, "order.txt"), "utf8").trim().split("\n").map((l) => l.split(" "));
  assert.deepEqual(order.map((o) => o[0]), ["api", "web"]);
  assert.ok(await answers(port), "the db was ready before the api started");
  await t.call("stop");
});

test("a part that never becomes ready is reported after its limit with its last lines; everything started is stopped", async () => {
  const port = await freePort();
  const s = await setup({ parts: [part("db", "node db.js", { ready: { port } }), part("slow", "node slow.js", { waitFor: ["db"], ready: { line: "never printed" }, timeoutSeconds: 1 })] }, {
    "db.js": `require("net").createServer().listen(${port}, "127.0.0.1"); setInterval(() => {}, 1000);`,
    "slow.js": `console.log("warming up"); setInterval(() => {}, 1000);`,
  });
  const t = await s.boot();
  await t.call("accept");
  const r = (await t.call("play")).body;
  assert.equal(r.started, false);
  assert.equal(r.reason, "failed");
  assert.equal(r.failed.part, "slow");
  assert.match(r.failed.why, /ready/i);
  assert.ok(r.failed.lastLines.includes("warming up"));
  assert.ok(await until(async () => !(await answers(port))), "the db was stopped too");
});

test("a part that exits with an error before it is ready is reported at once, not after the limit", async () => {
  const s = await setup({ parts: [part("bad", "node bad.js", { ready: { line: "up" }, timeoutSeconds: 30 })] }, { "bad.js": `console.error("cannot bind"); process.exit(2);` });
  const t = await s.boot();
  await t.call("accept");
  const began = Date.now();
  const r = (await t.call("play")).body;
  assert.ok(Date.now() - began < 10_000);
  assert.deepEqual([r.started, r.failed.part], [false, "bad"]);
  assert.match(r.failed.why, /exited with code 2/);
  assert.ok(r.failed.lastLines.includes("cannot bind"));
  assert.match(r.hint, /Terminal/);
});

test("Stop all ends parts in the reverse of the start order; one part can be stopped, and restarted with what depends on it", async () => {
  const port = await freePort();
  const s = await setup({ parts: [part("db", "node db.js", { ready: { port } }), part("api", "node api.js", { waitFor: ["db"] })] }, {
    "db.js": `require("net").createServer().listen(${port}, "127.0.0.1", () => console.log("db up " + Date.now())); setInterval(() => {}, 1000);`,
    "api.js": `console.log("api up " + Date.now()); setInterval(() => {}, 1000);`,
  });
  const t = await s.boot();
  await t.call("accept");
  await t.call("play");
  const first = (await output(t, "api")).lines.join("");
  // Restart the db: the api, which depends on it, restarts after it.
  const re = (await t.call("restart", { part: "db" })).body;
  assert.equal(re.started, true, JSON.stringify(re));
  assert.ok(await until(async () => (await output(t, "api")).lines.join("") !== first && (await output(t, "api")).alive));
  assert.ok(await answers(port));
  // Stopping only the api leaves the db.
  await t.call("stop", { part: "api" });
  assert.ok(await until(async () => (await output(t, "api")).alive === false));
  assert.equal((await output(t, "db")).alive, true);
  await t.call("play");
  await t.call("stop");
  assert.deepEqual((await t.call("output")).body.stoppedOrder, ["api", "db"]);
});

test("closing the core stops what Play started", async () => {
  const port = await freePort();
  const s = await setup({ parts: [part("db", "node db.js", { ready: { port } })] }, { "db.js": `require("net").createServer().listen(${port}, "127.0.0.1"); setInterval(() => {}, 1000);` });
  const t = await s.boot();
  await t.call("accept");
  await t.call("play");
  assert.ok(await answers(port));
  t.core.close();
  await t.core.plugins.deactivate("run");
  assert.ok(await until(async () => !(await answers(port))));
});
