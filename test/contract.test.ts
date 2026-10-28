import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { createClaudeAdapter } from "../src/core/adapter/claude.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

type Call = { name: string; arguments?: unknown };
type RunOptions = Parameters<Adapter["run"]>[0];

// A stand-in builder: lists the tools, makes the scripted calls over MCP, and keeps what it was launched with.
let script: Call[] = [];
let listTools = false;
const told: string[] = [];
const launched: RunOptions[] = [];
const asBuilder: Adapter = {
  options: { modes: [], models: [] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    launched.push(opts);
    const url = JSON.parse(opts.permission!.mcpConfig).mcpServers.aidea.url as string;
    let id = 1;
    const rpc = (method: string, params: unknown) =>
      fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }) }).then((r) => r.json());
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } });
    if (listTools) told.push(((await rpc("tools/list", {})).result.tools as { name: string }[]).map((t) => t.name).join(","));
    for (const call of script) told.push((await rpc("tools/call", call)).result.content[0].text);
    yield { type: "result", text: "", usage: {} };
  },
};

let core: Awaited<ReturnType<typeof startCore>>;
const scratch: string[] = [];
before(async () => {
  core = await startCore({ port: 0, adapter: asBuilder });
});
after(() => {
  core.close();
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const post = (path: string, body: unknown) =>
  fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const getContract = async (project: string) => {
  const res = await fetch(`${core.url}/contract?project=${encodeURIComponent(project)}`);
  return { status: res.status, body: (await res.json()) as any };
};

async function open(fromFixture?: string) {
  const dir = mkdtempSync(join(tmpdir(), "aidea-contract-"));
  scratch.push(dir);
  writeFileSync(join(dir, "a.py"), "def a():\n    return 1\n");
  if (fromFixture) cpSync(fixture(fromFixture), dir, { recursive: true });
  await post("/projects", { path: dir });
  return dir;
}
const why = { why: "Because.", rejected: [{ option: "Else", reason: "Worse." }] };
const writeLayer = (dir: string, layer: string, nodes: unknown[]) => {
  mkdirSync(join(dir, ".aidea"), { recursive: true });
  writeFileSync(join(dir, ".aidea", `${layer}.json`), JSON.stringify({ nodes }));
};
// Everything the indicator asks for.
async function openComplete() {
  const dir = await open();
  writeLayer(dir, "business", [
    { id: "cs-owners", title: "Shop owners", block: "customer segments", rationale: why },
    { id: "vp-fast", title: "Quotes in a minute", block: "value propositions", rationale: why },
  ]);
  writeLayer(dir, "requirements", [
    { id: "us-quote", title: "Request a quote", as: "owner", want: "a form", so: "I get a price", criteria: ["Given a form, When sent, Then a quote arrives"], rationale: why },
    { id: "nfr-fast", title: "Fast", kind: "non-functional", statement: "Instant.", quality: "performance", measure: "under 200 ms", rationale: why },
  ]);
  writeLayer(dir, "architecture", [
    { id: "web", title: "Web app", technology: "Node", kind: "container", description: "Serves the form.", relations: [{ to: "db", label: "reads" }], rationale: why },
    { id: "db", title: "Database", technology: "SQLite", kind: "container", rationale: why },
  ]);
  return dir;
}

async function builderReads(project: string, calls: Call[], withToolList = false) {
  script = calls;
  listTools = withToolList;
  told.length = 0;
  launched.length = 0;
  const res = await post("/chat", { project, message: "build it" });
  await res.text();
  return [...told];
}

test("the builder's tool list has read_contract, and it returns the accepted layers in compact form", async () => {
  const dir = await openComplete();
  const [tools, text] = await builderReads(dir, [{ name: "read_contract" }], true);
  assert.match(tools, /read_contract/);
  const contract = JSON.parse(text);
  assert.deepEqual(Object.keys(contract).sort(), ["architecture", "business", "requirements"]);
  assert.deepEqual(contract.business["customer segments"], [{ id: "cs-owners", title: "Shop owners", rationale: why }]);
  assert.equal(contract.business["value propositions"][0].id, "vp-fast");
  const [fn, nfr] = contract.requirements;
  assert.deepEqual(fn, { id: "us-quote", title: "Request a quote", kind: "functional", as: "owner", want: "a form", so: "I get a price", criteria: ["Given a form, When sent, Then a quote arrives"], rationale: why });
  assert.deepEqual(nfr, { id: "nfr-fast", title: "Fast", kind: "non-functional", statement: "Instant.", quality: "performance", measure: "under 200 ms", rationale: why });
  const web = contract.architecture[0];
  assert.deepEqual(web, { id: "web", title: "Web app", kind: "container", technology: "Node", description: "Serves the form.", relations: [{ to: "db", label: "reads" }], rationale: why });
});

test("read_contract leaves out pending Proposals", async () => {
  const dir = await openComplete();
  const node = { id: "cs-new", title: "Newcomers", block: "customer segments", rationale: why };
  const [added, text] = await builderReads(dir, [{ name: "propose_add_node", arguments: { layer: "business", node } }, { name: "read_contract" }]);
  assert.match(added, /pending/);
  assert.ok(!text.includes("cs-new"));
});

test("the builder session is told to read the Contract first and to depart from it only through a Proposal", async () => {
  const dir = await openComplete();
  await builderReads(dir, []);
  const instructions = launched[0].instructions ?? "";
  assert.match(instructions, /read_contract/);
  assert.match(instructions, /before/i);
  assert.match(instructions, /Proposal/);
});

test("the Claude adapter appends the instructions to Claude Code's system prompt", async () => {
  const seen: string[][] = [];
  const spawn = (args: string[]) => {
    seen.push(args);
    const child = new EventEmitter() as any;
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.kill = () => {};
    setImmediate(() => { child.stdout.end(); child.stderr.end(); child.emit("close", 0); });
    return child;
  };
  const run = async (opts: Partial<RunOptions>) => {
    for await (const _ of createClaudeAdapter(spawn).run({ cwd: ".", message: "hi", ...opts })) { /* drain */ }
  };
  await run({ instructions: "READ FIRST" });
  assert.equal(seen[0][seen[0].indexOf("--append-system-prompt") + 1], "READ FIRST");
  await run({});
  assert.ok(!seen[1].includes("--append-system-prompt"));
});

test("an empty project shows every check unmet and a Contract with nothing in it", async () => {
  const dir = await open();
  const { status, body } = await getContract(dir);
  assert.equal(status, 200);
  assert.equal(body.readiness.length, 6);
  assert.ok(body.readiness.every((c: any) => c.met === false && typeof c.id === "string" && c.text.includes(":")));
  assert.equal(body.readiness[1].text, "Value proposition: nothing written yet");
  assert.deepEqual(body.layers.requirements, []);
  assert.deepEqual(body.layers.architecture, []);
});

test("a complete project meets every check, with counts in plain words", async () => {
  const dir = await openComplete();
  const { body } = await getContract(dir);
  assert.ok(body.readiness.every((c: any) => c.met), JSON.stringify(body.readiness));
  const text = (id: string) => body.readiness.find((c: any) => c.id === id).text;
  assert.equal(text("value-proposition"), "Value proposition: 1 note");
  assert.equal(text("containers"), "Containers: 2");
  assert.equal(body.layers.business["customer segments"].length, 1);
});

test("the studio fixtures show the expected results", async () => {
  const met = async (name: string) => Object.fromEntries((await getContract(await open(name))).body.readiness.map((c: any) => [c.id, c.met]));
  assert.deepEqual(await met("studio"), {
    "customer-segments": false, "value-proposition": true, "functional-requirement": true,
    "non-functional-requirement": false, "criteria": false, "containers": false,
  });
  assert.equal((await met("studio-c4")).containers, true);
  const reqs = await met("studio-requirements");
  assert.equal(reqs["non-functional-requirement"], true);
  assert.equal(reqs.criteria, false); // "us-old" has none
});

test("the route needs an open Project and nothing blocks an incomplete Contract", async () => {
  assert.equal((await getContract("nope")).status, 404);
  const dir = await open("studio"); // incomplete
  const [text] = await builderReads(dir, [{ name: "read_contract" }]);
  assert.ok(JSON.parse(text).requirements.length === 1);
  assert.equal(launched.length, 1); // the builder ran
});
