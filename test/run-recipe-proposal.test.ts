import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// Run-and-terminal 10: the Builder proposes the run recipe through a tool. The core checks that every ready signal rests on a file that shows it;
// the person accepts or rejects; accepting writes `.aidea/run.json`; Play then asks for the usual acceptance (ticket 04).
const scratch = mkdtempSync(join(tmpdir(), "aidea-recipe-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 8, retryDelay: 300 }));

const rpcTo = (url: string) => (method: string, params: unknown, id?: number) =>
  fetch(url, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: JSON.stringify({ jsonrpc: "2.0", id, method, params }) });

// A stand-in for the Builder: the message is a JSON list of the arguments of each propose_run_recipe call to make.
const seen: { tools: { name: string; description: string }[]; results: { isError: boolean; text: string }[] } = { tools: [], results: [] };
const asBuilder: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ permission, message }): AsyncGenerator<AgentEvent> {
    const rpc = rpcTo(JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string);
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } }, 1);
    await rpc("notifications/initialized", {});
    seen.tools = (await (await rpc("tools/list", {}, 2)).json()).result.tools.map((t: any) => ({ name: t.name, description: t.description }));
    seen.results = [];
    for (const args of JSON.parse(message) as unknown[]) {
      const r = (await (await rpc("tools/call", { name: "propose_run_recipe", arguments: args }, 3)).json()).result;
      seen.results.push({ isError: r.isError === true, text: r.content[0].text });
    }
    yield { type: "text", text: "done" };
  },
};

let n = 0;
async function start(files: Record<string, string> = {}) {
  const project = join(scratch, `project${n++}`);
  cpSync(fixture("shop"), project, { recursive: true });
  for (const [f, t] of Object.entries(files)) { mkdirSync(join(project, f, ".."), { recursive: true }); writeFileSync(join(project, f), t); }
  const store = join(scratch, `store${n++}`);
  mkdirSync(store, { recursive: true });
  const core = await startCore({ port: 0, adapter: asBuilder, pluginsDir: store });
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const id = ((await (await post("/projects", { path: project })).json()) as any).id;
  const call = async (name: string, body: object = {}) => { const r = await post(`/plugins/run/call/${name}`, { project: id, ...body }); return { status: r.status, body: (await r.json()) as any }; };
  const ask = async (...calls: unknown[]) => {
    const events: any[] = (await (await post("/chat", { project: id, message: JSON.stringify(calls) })).text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));
    return events.filter((e) => e.type === "run_recipe_proposal");
  };
  return { core, project, call, ask };
}
const part = (name: string, command: string, extra: object = {}) => ({ name, command, ...extra });
const recipeFile = (project: string) => join(project, ".aidea", "run.json");
const DB = 'require("net").createServer().listen(5432, "127.0.0.1");';
const API = 'console.log("api listening on 3000");';

test("the Builder has a tool to propose the run recipe, and its description tells it to ask the person when nothing shows a part is ready", async () => {
  const t = await start();
  try {
    await t.ask();
    const tool = seen.tools.find((x) => x.name === "propose_run_recipe");
    assert.ok(tool, seen.tools.map((x) => x.name).join(", "));
    assert.match(tool!.description, /ask the person/i);
    assert.match(tool!.description, /never invent/i);
  } finally { t.core.close(); }
});

test("a proposal names every part, its ready signal and the files it rests on; the person is told with a secret; nothing is written", async () => {
  const t = await start({ "db.js": DB, "api.js": API });
  try {
    const events = await t.ask({ parts: [part("db", "node db.js", { ready: { port: 5432 }, evidence: ["db.js"] }), part("api", "node api.js", { waitFor: ["db"], ready: { line: "api listening" }, evidence: ["api.js"] })] });
    assert.equal(seen.results[0].isError, false, seen.results[0].text);
    assert.equal(events.length, 1);
    assert.equal(typeof events[0].secret, "string");
    assert.deepEqual(events[0].parts.map((p: any) => [p.name, p.ready, p.evidence]), [["db", { port: 5432 }, ["db.js"]], ["api", { line: "api listening" }, ["api.js"]]]);
    assert.equal(existsSync(recipeFile(t.project)), false);
    const listed = (await t.call("proposals")).body.proposals;
    assert.equal(listed.length, 1);
    assert.equal(listed[0].secret, undefined); // the secret stays with the window that heard of the proposal
    assert.equal(listed[0].before, null);
  } finally { t.core.close(); }
});

test("a ready signal that no cited file shows is refused by name: a signal is never given without a check", async () => {
  const t = await start({ "db.js": DB });
  try {
    await t.ask(
      { parts: [part("db", "node db.js", { ready: { port: 9999 }, evidence: ["db.js"] })] }, // the file does not mention 9999
      { parts: [part("db", "node db.js", { ready: { port: 5432 } })] }, // no file cited
      { parts: [part("db", "node db.js", { ready: { port: 5432 }, evidence: ["missing.js"] })] }, // the file is not there
      { parts: [part("db", "node db.js", { ready: { port: 5432 }, evidence: ["../outside.js"] })] }, // outside the Project
    );
    assert.equal(seen.results.length, 4);
    for (const r of seen.results) { assert.equal(r.isError, true, r.text); assert.match(r.text, /db/); }
    assert.match(seen.results[0].text, /9999/);
    assert.equal((await t.call("proposals")).body.proposals.length, 0);
  } finally { t.core.close(); }
});

test("a part with nothing observable may have no ready signal: it is listed as such, never given an invented one", async () => {
  const t = await start({ "job.js": "console.log(1)" });
  try {
    const events = await t.ask({ parts: [part("job", "node job.js")] });
    assert.equal(seen.results[0].isError, false, seen.results[0].text);
    assert.equal(events[0].parts[0].ready, null);
  } finally { t.core.close(); }
});

test("an invalid recipe is refused with the same messages the recipe check gives", async () => {
  const t = await start();
  try {
    await t.ask({ parts: [part("a", "x", { waitFor: ["b"] }), part("b", "y", { waitFor: ["a"] })] }, { parts: [] });
    assert.match(seen.results[0].text, /cycle/i);
    assert.match(seen.results[1].text, /parts/);
    assert.ok(seen.results.every((r) => r.isError));
  } finally { t.core.close(); }
});

test("rejecting leaves no recipe; a wrong secret decides nothing", async () => {
  const t = await start({ "db.js": DB });
  try {
    const [event] = await t.ask({ parts: [part("db", "node db.js", { ready: { port: 5432 }, evidence: ["db.js"] })] });
    const wrong = await t.call("decide", { id: event.id, secret: "not-it", decision: "accept" });
    assert.notEqual(wrong.status, 200);
    assert.equal(existsSync(recipeFile(t.project)), false);
    assert.equal((await t.call("decide", { id: event.id, secret: event.secret, decision: "reject" })).status, 200);
    assert.equal(existsSync(recipeFile(t.project)), false);
    assert.equal((await t.call("proposals")).body.proposals.length, 0);
    assert.notEqual((await t.call("decide", { id: event.id, secret: event.secret, decision: "accept" })).status, 200); // already decided
  } finally { t.core.close(); }
});

test("the proposal cannot be made, nor its secret learned, by calling the plugin over HTTP", async () => {
  const t = await start({ "db.js": DB });
  try {
    const r = await t.call("propose", { parts: [part("db", "node db.js")], secret: "mine" });
    assert.equal(r.status, 404);
    assert.equal((await t.call("decide", { id: "x", secret: "mine", decision: "accept" })).status === 200, false);
  } finally { t.core.close(); }
});

test("accepting writes .aidea/run.json without the evidence; Play then asks the person to accept the recipe as usual", async () => {
  const t = await start({ "db.js": DB, "api.js": API });
  try {
    const [event] = await t.ask({ parts: [part("db", "node db.js", { ready: { port: 5432 }, evidence: ["db.js"] }), part("api", "node api.js", { waitFor: ["db"], ready: { line: "api listening" }, evidence: ["api.js"], env: ["API_KEY"] })] });
    assert.equal((await t.call("decide", { id: event.id, secret: event.secret, decision: "accept" })).status, 200);
    const written = JSON.parse(readFileSync(recipeFile(t.project), "utf8"));
    assert.deepEqual(written.parts.map((p: any) => p.name), ["db", "api"]);
    assert.ok(written.parts.every((p: any) => p.evidence === undefined));
    assert.deepEqual(written.parts[1].env, ["API_KEY"]);
    const play = (await t.call("play")).body;
    assert.equal(play.reason, "needs-accept");
    assert.equal(play.whole.parts.length, 2);
  } finally { t.core.close(); }
});

test("asking for a review of an existing recipe shows the old one beside the proposal and overwrites nothing until accepted", async () => {
  const t = await start({ "db.js": DB });
  try {
    mkdirSync(join(t.project, ".aidea"), { recursive: true });
    const old = JSON.stringify({ parts: [{ name: "db", command: "node old.js" }] });
    writeFileSync(recipeFile(t.project), old);
    const [event] = await t.ask({ parts: [part("db", "node db.js", { ready: { port: 5432 }, evidence: ["db.js"] })] });
    const listed = (await t.call("proposals")).body.proposals[0];
    assert.equal(listed.before.parts[0].command, "node old.js");
    assert.deepEqual(listed.changes, { added: [], removed: [], changed: ["db"] });
    assert.equal(readFileSync(recipeFile(t.project), "utf8"), old);
    await t.call("decide", { id: event.id, secret: event.secret, decision: "accept" });
    assert.equal(JSON.parse(readFileSync(recipeFile(t.project), "utf8")).parts[0].command, "node db.js");
  } finally { t.core.close(); }
});

// Review fix: a signal is "shown" only when the cited file holds it whole, not as a piece of a longer number.
test("a port is shown only as a whole number: 80 is not shown by a file that says 8080", async () => {
  const t = await start({ "web.js": 'listen(8080); // not the port 80 one', "web80.js": "listen(80);", "web3.js": "const p = 18080;" });
  try {
    await t.ask(
      { parts: [part("web", "node web.js", { ready: { port: 80 }, evidence: ["web3.js"] })] }, // 18080 contains 80 only inside a longer number
      { parts: [part("web", "node web.js", { ready: { port: 8000 }, evidence: ["web.js"] })] }, // 8080 is not 8000
      { parts: [part("web", "node web.js", { ready: { port: 80 }, evidence: ["web80.js"] })] }, // listen(80) shows it
      { parts: [part("web", "node web.js", { ready: { port: 8080 }, evidence: ["web.js"] })] },
    );
    assert.deepEqual(seen.results.map((r) => r.isError), [true, true, false, false], seen.results.map((r) => r.text).join(" | "));
  } finally { t.core.close(); }
});

test("a ready address is checked by its port, or by its path when it has no port; a bare host proves nothing and is refused", async () => {
  const t = await start({ "srv.js": 'app.get("/health", ok); listen(3000);' });
  try {
    await t.ask(
      { parts: [part("a", "x", { ready: { url: "http://127.0.0.1:3000/health" }, evidence: ["srv.js"] })] },
      { parts: [part("a", "x", { ready: { url: "http://127.0.0.1:3001/health" }, evidence: ["srv.js"] })] }, // another port
      { parts: [part("a", "x", { ready: { url: "http://localhost/health" }, evidence: ["srv.js"] })] }, // no port: the path is what is shown
      { parts: [part("a", "x", { ready: { url: "http://localhost/" }, evidence: ["srv.js"] })] }, // no port, no path: nothing to check
    );
    assert.deepEqual(seen.results.map((r) => r.isError), [false, true, false, true], seen.results.map((r) => r.text).join(" | "));
    assert.match(seen.results[3].text, /port or a path/i);
  } finally { t.core.close(); }
});
