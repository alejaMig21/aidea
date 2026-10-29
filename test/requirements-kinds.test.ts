import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { loadAuthored } from "../src/core/authored.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// A stand-in for the builder: it makes these tool calls over MCP and tells what each answered, plus the tool descriptions.
let script: { name: string; arguments?: unknown }[] = [];
const seen: { isError: boolean; text: string }[] = [];
let descriptions = "";
const asBuilder: Adapter = {
  options: { modes: [], models: [] },
  run: async function* ({ permission }): AsyncGenerator<AgentEvent> {
    const url = JSON.parse(permission!.mcpConfig).mcpServers.aidea.url as string;
    let id = 1;
    const rpc = (method: string, params: unknown) =>
      fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
      }).then((r) => r.json());
    await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "fake", version: "0" } });
    const listed = await rpc("tools/list", {});
    descriptions = listed.result.tools.map((t: { description: string }) => t.description).join("\n");
    for (const call of script) {
      const reply = await rpc("tools/call", call);
      const result = reply.result ?? { isError: true, content: [{ text: JSON.stringify(reply.error) }] };
      seen.push({ isError: !!result.isError, text: result.content[0].text });
      yield { type: "text", text: result.content[0].text };
    }
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
const get = (path: string) => fetch(core.url + path);
const enc = encodeURIComponent;

async function freshProject() {
  const dir = mkdtempSync(join(tmpdir(), "aidea-requirements-"));
  scratch.push(dir);
  cpSync(fixture("studio"), dir, { recursive: true });
  await post("/projects", { path: dir });
  return dir;
}
async function builderCalls(project: string, calls: typeof script) {
  script = calls;
  seen.length = 0;
  const res = await post("/chat", { project, message: "propose" });
  const events = (await res.text()).trim().split("\n").map((l) => JSON.parse(l)) as Record<string, any>[];
  return { told: [...seen], proposals: events.filter((e) => e.type === "proposal") };
}
const why = { why: "A reason.", rejected: [] };
const nfr = { id: "nfr-safe", title: "Safe uploads", kind: "non-functional", statement: "Uploaded files never run.", quality: "security", measure: "no uploaded file is ever executed", rationale: why };
const story = { id: "us-x", title: "Story", as: "a person", want: "to do it", so: "it is done", rationale: why };
const add = (node: unknown) => ({ name: "propose_add_node", arguments: { layer: "requirements", node } });
const update = (id: string, changes: unknown) => ({ name: "propose_update_node", arguments: { layer: "requirements", id, changes } });

test("functional and non-functional requirements load; old files without kind stay functional", async () => {
  await post("/projects", { path: fixture("studio-requirements") });
  const body = await (await get(`/authored?project=${enc(fixture("studio-requirements"))}`)).json();
  const layer = body.layers.requirements;
  assert.deepEqual(layer.nodes.map((n: any) => n.id), ["us-save-pdf", "us-old", "nfr-fast"]);
  assert.equal(layer.nodes[0].criteria.length, 2);
  assert.equal(layer.nodes[1].kind, undefined); // loaded unchanged
  assert.deepEqual(
    layer.nodes[2],
    { id: "nfr-fast", title: "Quotes feel instant", kind: "non-functional", statement: "Building a quote does not make the person wait.", quality: "performance", measure: "95 percent of quotes are built in under 300 ms", traces: ["web-app", "app.run"], rationale: { why: "Waiting loses the sale.", rejected: [] } },
  );
});

test("bad requirements are dropped with an error that names the field", async () => {
  const body = await (await get(`/authored?project=${enc(fixture("studio-requirements"))}`)).json();
  assert.deepEqual(body.layers.requirements.errors.map((e: any) => e.message), [
    'nodes[3]: "statement" must be a non-empty string',
    `nodes[4]: "quality" must be one of: performance, security, usability, reliability, maintainability, compatibility, portability, safety`,
    'nodes[5]: "measure" must be a non-empty string',
    'nodes[6]: "kind" must be "functional" or "non-functional"',
    'nodes[7]: "criteria" must be an array of non-empty strings',
    'nodes[8]: "as" must be a non-empty string',
  ]);
});

test("the Requirements layout puts functional on the left and non-functional on the right, stacked in file order without overlap", async () => {
  const path = `/layout?project=${enc(fixture("studio-requirements"))}&layer=requirements`;
  const { rects } = await (await get(path)).json();
  assert.deepEqual(rects, (await (await get(path)).json()).rects); // deterministic
  const by = Object.fromEntries(rects.map((r: any) => [r.id, r]));
  assert.ok(by["nfr-fast"].x >= by["us-save-pdf"].x + by["us-save-pdf"].width);
  assert.equal(by["us-old"].x, by["us-save-pdf"].x);
  assert.ok(by["us-old"].y >= by["us-save-pdf"].y + by["us-save-pdf"].height); // below the first story, which is taller with its criteria
  assert.ok(by["us-save-pdf"].height > by["us-old"].height);
});

test("the room between the two columns is a fixed small gap: a chip (24 + 170) and a margin, no wide empty space", async () => {
  const { rects } = await (await get(`/layout?project=${enc(fixture("studio-requirements"))}&layer=requirements`)).json();
  const by = Object.fromEntries(rects.map((r: any) => [r.id, r]));
  const gap = by["nfr-fast"].x - (by["us-save-pdf"].x + by["us-save-pdf"].width);
  assert.ok(gap >= 24 + 170 + 40, `the chips need room, got ${gap}`);
  assert.ok(gap <= 24 + 170 + 70, `the gap is wider than a chip plus a margin: ${gap}`);
});

test("a functional requirement may trace to code and zooms to Components; a non-functional one traces to Architecture only", async () => {
  const project = fixture("studio-requirements");
  const { links } = await (await get(`/traces?project=${enc(project)}`)).json();
  const mine = links.filter((l: any) => l.layer === "requirements").map((l: any) => [l.from, l.to, l.broken]);
  assert.deepEqual(mine, [["us-save-pdf", "app.run", false], ["nfr-fast", "web-app", false], ["nfr-fast", "app.run", true]]);
  const res = await post("/focus", { project, layer: "requirements", node: "us-save-pdf" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json().then((b) => [b.layer, b.footprint]), ["components", ["app.run"]]);
});

test("Proposals accept both kinds and refuse bad fields with the same rules", async () => {
  const dir = await freshProject();
  const { told, proposals } = await builderCalls(dir, [
    add(nfr),
    add({ ...story, id: "us-y", criteria: ["Given a, When b, Then c"] }),
    add({ ...nfr, id: "n2", measure: "" }),
    add({ ...nfr, id: "n3", quality: "speed" }),
    add({ ...nfr, id: "n4", statement: undefined }),
    add({ ...story, id: "us-z", criteria: [3] }),
    update("us-request-quote", { criteria: ["Given a form, When sent, Then a price shows"] }),
  ]);
  assert.deepEqual(told.map((t) => t.isError), [false, false, true, true, true, true, false]);
  assert.match(told[2].text, /"measure"/);
  assert.match(told[3].text, /"quality"/);
  assert.match(told[4].text, /"statement"/);
  assert.match(told[5].text, /"criteria"/);
  assert.equal(proposals.length, 3);

  const res = await post("/proposals/answer", { id: proposals[0].id, secret: proposals[0].secret, decision: "accept" });
  assert.equal(res.status, 200);
  const nodes = loadAuthored(dir).layers.requirements.nodes as any[]; // whichever way the layer is stored
  assert.deepEqual(nodes.map((n: any) => n.id), ["us-request-quote", "nfr-safe"]);
});

test("changing a functional requirement into a non-functional one needs its new fields", async () => {
  const dir = await freshProject();
  const { told } = await builderCalls(dir, [update("us-request-quote", { kind: "non-functional" })]);
  assert.equal(told[0].isError, true);
  assert.match(told[0].text, /"statement"/);
});

test("the builder's tool descriptions mention the kinds and their fields", async () => {
  const dir = await freshProject();
  await builderCalls(dir, [{ name: "list_proposals" }]);
  for (const word of ["kind", "non-functional", "criteria", "statement", "quality", "measure"]) assert.ok(descriptions.includes(word), word);
});
