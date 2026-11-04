import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

type Call = { name: string; arguments?: unknown };
let script: Call[] = [];
let listTools = false;
const told: string[] = [];
const asBuilder: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ permission }): AsyncGenerator<AgentEvent> {
    const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
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
const q = (dir: string) => encodeURIComponent(dir);
const json = async (path: string) => (await fetch(core.url + path)).json() as Promise<any>;

// A private copy of a fixture, opened as a Project.
async function open(name: string) {
  const dir = mkdtempSync(join(tmpdir(), "aidea-patterns-"));
  scratch.push(dir);
  cpSync(fixture(name), dir, { recursive: true });
  await post("/projects", { path: dir });
  return dir;
}
const archFile = (dir: string) => join(dir, ".aidea", "architecture.json");
const editArchitecture = async (dir: string, change: (doc: any) => void) => {
  const doc = JSON.parse(readFileSync(archFile(dir), "utf8"));
  change(doc);
  writeFileSync(archFile(dir), JSON.stringify(doc));
  await post("/projects", { path: dir });
};
const why = { why: "Because.", rejected: [] };

test("a Pattern group is stored with the Architecture layer and comes back as written", async () => {
  const dir = await open("hexagonal");
  const data = await json(`/authored?project=${q(dir)}`);
  assert.deepEqual(data.layers.architecture.errors, []);
  assert.deepEqual(data.problems, []);
  assert.deepEqual(data.layers.architecture.patterns, [
    {
      id: "hex", name: "Hexagonal shop", kind: "hexagonal",
      roles: [{ node: "core", role: "domain" }, { node: "web", role: "adapter" }, { node: "store", role: "infrastructure" }],
    },
  ]);
});

test("a file without patterns loads exactly as before", async () => {
  const dir = await open("studio");
  const layer = (await json(`/authored?project=${q(dir)}`)).layers.architecture;
  assert.equal("patterns" in layer, false);
});

test("domain importing infrastructure is reported with the two Nodes, the rule and the evidence", async () => {
  const dir = await open("hexagonal");
  const { violations } = await json(`/patterns?project=${q(dir)}`);
  assert.equal(violations.length, 1);
  const v = violations[0];
  assert.deepEqual([v.group, v.kind, v.from, v.to], ["hex", "hexagonal", { node: "core", role: "domain" }, { node: "store", role: "infrastructure" }]);
  assert.equal(v.rule, "A domain Node may not depend on an infrastructure Node");
  assert.equal(v.certainty, "certain");
  assert.ok(v.evidence.some((e: any) => e.kind === "imports" && e.from === "domain" && e.to === "infra" && e.resolution === "resolved"));
});

test("the same violations are in the Contract drift list", async () => {
  const dir = await open("hexagonal");
  const contract = await json(`/contract?project=${q(dir)}`);
  assert.equal(contract.drift.length, 1);
  assert.deepEqual([contract.drift[0].type, contract.drift[0].from.node, contract.drift[0].to.node], ["pattern", "core", "store"]);
});

test("a group the code respects reports no violation", async () => {
  const dir = await open("hexagonal-clean");
  assert.deepEqual((await json(`/patterns?project=${q(dir)}`)).violations, []);
  assert.deepEqual((await json(`/contract?project=${q(dir)}`)).drift, []);
});

test("an edge matched only by name is reported as possible, never certain", async () => {
  const dir = await open("hexagonal-clean");
  writeFileSync(join(dir, "domain.py"), "def place_order(order, repo):\n    return repo.save(order)\n");
  writeFileSync(join(dir, "infra.py"), "class Store:\n    def save(self, order):\n        return order\n");
  await post("/projects", { path: dir });
  const { violations } = await json(`/patterns?project=${q(dir)}`);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].certainty, "possible");
  assert.ok(violations[0].evidence.every((e: any) => e.resolution !== "resolved"));
});

test("layered: a lower layer depending on an upper one is a violation, the other way is fine", async () => {
  const dir = await open("hexagonal");
  await editArchitecture(dir, (doc) => {
    // domain (core) imports infra (store). As layers, data = store is below domain = core: no violation.
    doc.patterns = [{ id: "layers", name: "Layers", kind: "layered", roles: [{ node: "core", role: "domain" }, { node: "store", role: "data" }, { node: "web", role: "presentation" }] }];
  });
  assert.deepEqual((await json(`/patterns?project=${q(dir)}`)).violations, []);
  await editArchitecture(dir, (doc) => {
    doc.patterns = [{ id: "layers", name: "Layers", kind: "layered", roles: [{ node: "core", role: "data" }, { node: "store", role: "domain" }] }];
  });
  const { violations } = await json(`/patterns?project=${q(dir)}`);
  assert.deepEqual(violations.map((v: any) => [v.from.node, v.to.node, v.rule]), [["core", "store", "A data Node may not depend on a domain Node (a lower layer on an upper one)"]]);
});

test("a role pointing at a missing Node is a problem of that role only", async () => {
  const dir = await open("hexagonal");
  await editArchitecture(dir, (doc) => doc.patterns[0].roles.push({ node: "ghost", role: "port" }));
  const data = await json(`/authored?project=${q(dir)}`);
  assert.equal(data.layers.architecture.patterns[0].roles.length, 3);
  const mine = data.problems.filter((p: any) => p.layer === "architecture");
  assert.equal(mine.length, 1);
  assert.equal(mine[0].field, "patterns[0].roles[3].node");
  assert.match(mine[0].message, /"ghost".*does not exist.*role was ignored/s);
  assert.equal((await json(`/patterns?project=${q(dir)}`)).violations.length, 1); // the rest still works
});

test("an unknown role or an unknown kind is reported; the rest of the file is kept", async () => {
  const dir = await open("hexagonal");
  await editArchitecture(dir, (doc) => {
    doc.patterns[0].roles[1].role = "wizard";
    doc.patterns.push({ id: "odd", name: "Odd", kind: "spaghetti", roles: [] });
  });
  const data = await json(`/authored?project=${q(dir)}`);
  assert.equal(data.layers.architecture.nodes.length, 3);
  assert.deepEqual(data.layers.architecture.patterns.map((p: any) => [p.id, p.roles.length]), [["hex", 2]]);
  assert.deepEqual(data.problems.map((p: any) => p.field), ["patterns[0].roles[1].role", "patterns[1].kind"]);
});

test("a patterns field that is not a list, or a group without an id, is a problem and nothing else", async () => {
  const dir = await open("hexagonal");
  await editArchitecture(dir, (doc) => (doc.patterns = { nope: true }));
  let data = await json(`/authored?project=${q(dir)}`);
  assert.equal(data.layers.architecture.nodes.length, 3);
  assert.deepEqual(data.problems.map((p: any) => p.field), ["patterns"]);
  await editArchitecture(dir, (doc) => (doc.patterns = [{ name: "x", kind: "hexagonal", roles: [] }]));
  data = await json(`/authored?project=${q(dir)}`);
  assert.deepEqual(data.problems.map((p: any) => p.field), ["patterns[0].id"]);
});

test("the builder can propose a Pattern group; it is validated, pending, and written only on accept", async () => {
  const dir = await open("hexagonal-clean");
  await editArchitecture(dir, (doc) => delete doc.patterns);
  const group = { id: "hex", name: "Hexagonal shop", kind: "hexagonal", roles: [{ node: "core", role: "domain" }, { node: "store", role: "infrastructure" }], rationale: why };
  const run = async (calls: Call[], withList = false) => {
    script = calls; listTools = withList; told.length = 0;
    const res = await post("/chat", { project: dir, message: "go" });
    return (await res.text()).trim().split("\n").map((l) => JSON.parse(l)) as Record<string, any>[];
  };

  const listed = await run([], true);
  assert.ok(listed && told[0].split(",").includes("propose_pattern_group"));

  await run([
    { name: "propose_pattern_group", arguments: { group: { ...group, kind: "spaghetti" } } },
    { name: "propose_pattern_group", arguments: { group: { ...group, roles: [{ node: "ghost", role: "domain" }] } } },
    { name: "propose_pattern_group", arguments: { group: { ...group, rationale: undefined } } },
  ]);
  assert.equal(told.length, 3);
  assert.match(told[0], /^Invalid group: "kind" must be one of: hexagonal, layered/);
  assert.match(told[1], /^Invalid group: roles "node" refers to unknown id "ghost"/);
  assert.match(told[2], /^Invalid group: "rationale"/);
  assert.equal((await json(`/proposals?project=${q(dir)}`)).proposals.length, 0);

  const events = await run([{ name: "propose_pattern_group", arguments: { group } }]);
  const proposal = events.find((e) => e.type === "proposal")!;
  assert.equal("blocking" in proposal, false);
  assert.equal(proposal.layer, "architecture");
  assert.equal(JSON.parse(readFileSync(archFile(dir), "utf8")).patterns, undefined); // nothing written yet
  const pending = (await json(`/proposals?project=${q(dir)}`)).proposals;
  assert.equal(pending.length, 1);
  assert.equal(pending[0].rect, null); // a group is not a box
  assert.equal((await json(`/proposals?project=${q(dir)}`)).previews.architecture?.rects.length ?? 3, 3); // no Node was invented

  assert.equal((await post("/proposals/answer", { id: proposal.id, secret: proposal.secret, decision: "accept" })).status, 200);
  // Stored as its own file (ADR 0005); the layer was converted to one file per Node.
  const groupFiles = readdirSync(join(dir, ".aidea", "architecture", "patterns"));
  assert.equal(groupFiles.length, 1);
  assert.equal(JSON.parse(readFileSync(join(dir, ".aidea", "architecture", "patterns", groupFiles[0]), "utf8")).id, "hex");
  const read = (await json(`/authored?project=${q(dir)}`)).layers.architecture;
  assert.deepEqual(read.patterns.map((p: any) => p.id), ["hex"]);
  assert.equal(read.nodes.length, 3);
  assert.deepEqual((await json(`/authored?project=${q(dir)}`)).problems, []);
});
