import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter, AgentEvent } from "../src/core/types.ts";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

type RunOptions = Parameters<Adapter["run"]>[0];

// A stand-in for Claude Code: it records how the Tutor was launched and says one line.
const launches: RunOptions[] = [];
const fakeAgent: Adapter = {
  options: { modes: [{ id: "default", label: "Manual", meaning: "", available: true }], models: [{ id: "haiku", label: "Haiku" }] },
  run: async function* (opts): AsyncGenerator<AgentEvent> {
    launches.push(opts);
    if (opts.role === "extractor") return yield { type: "result", text: "", structured: { propositions: [], chains: [] }, usage: {} };
    if (opts.role === "auditor") return yield { type: "result", text: "", structured: { links: [] }, usage: {} };
    if (opts.role === "tutor") yield { type: "text", text: "A queue holds work until a worker is free." };
  },
};

const project = fixture("shop");
const cores: Awaited<ReturnType<typeof startCore>>[] = [];
async function newCore() {
  const core = await startCore({ port: 0, adapter: fakeAgent, learnerDir: mkdtempSync(join(tmpdir(), "aidea-layer-")) });
  cores.push(core);
  await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
  const post = (path: string, body: unknown) => fetch(core.url + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const events = async (res: Response) => (await res.text()).split("\n").filter(Boolean).map((l) => JSON.parse(l));
  return { core, post, events, help: async () => (await fetch(core.url + "/layers/help")).json() as Promise<any> };
}
after(() => cores.forEach((c) => c.close()));

const LAYERS = ["business", "requirements", "architecture", "components", "flow", "data"];
const JARGON = /\b(UML|C4|ISO|DDD|SOLID|hexagonal|polymorphism|cyclomatic|AST|CFG|idempotent)\b/i;

test("each of the six layers has teaching content: a description, a guiding question, an example, and per element a hint, what it is, a question, an example and a narration", async () => {
  const { help } = await newCore();
  const all = await help();
  assert.deepEqual(Object.keys(all.layers), LAYERS);
  for (const id of LAYERS) {
    const layer = all.layers[id];
    for (const k of ["name", "what", "question", "example"]) assert.ok(typeof layer[k] === "string" && layer[k].trim(), `${id}.${k}`);
    assert.ok(Array.isArray(layer.order) && layer.order.length >= 3, `${id}.order`);
    assert.deepEqual([...layer.order].sort(), Object.keys(layer.elements).sort(), `${id}: order lists exactly the elements`);
    for (const [eid, e] of Object.entries<any>(layer.elements)) {
      for (const k of ["name", "hint", "what", "question", "example", "narration"]) {
        assert.ok(typeof e[k] === "string" && e[k].trim(), `${id}/${eid}.${k}`);
        assert.doesNotMatch(e[k], JARGON, `${id}/${eid}.${k} is plain words`);
      }
    }
    assert.doesNotMatch(JSON.stringify([layer.what, layer.question, layer.example]), JARGON, `${id} plain words`);
  }
});

test("the Business content in the core says what the Business blocks of the interface say", async () => {
  const { help } = await newCore();
  const ui = readFileSync(new URL("../src/ui/features/46-business-help.js", import.meta.url), "utf8");
  const business = (await help()).layers.business;
  assert.equal(business.order.length, 9);
  for (const e of Object.values<any>(business.elements)) {
    for (const k of ["hint", "what", "question", "example", "narration"]) assert.ok(ui.includes(JSON.stringify(e[k])), `UI and core differ on: ${e[k]}`);
  }
});

test("a layer class starts the Tutor on that layer with its content as data and the Plan to follow", async () => {
  const t = await newCore();
  launches.length = 0;
  const events = await t.events(await t.post("/tutor/classes", { project, layer: "requirements" }));
  const tutor = launches.find((l) => l.role === "tutor")!;
  assert.match(tutor.message, /requirements layer/i);
  assert.match(tutor.message, /acceptance criteria/i);
  assert.match(tutor.message, /get_plan/);
  assert.match(tutor.message, /propose_node/);
  // Found in a live run: a Teacher that is told to teach the Plan first never gets to co-author. The person speaks first, with an element question.
  assert.match(tutor.message, /co-authoring class, not a lecture/i);
  assert.match(tutor.message, /FIRST question[^\n]*ask[^\n]*element/i);
  assert.ok(tutor.message.indexOf("FIRST question") < tutor.message.indexOf("get_plan"), "the element question comes before any Plan work");
  assert.match(tutor.message, /requirements:functional-requirement/, "the element tag of the first element is given");
  assert.ok(events.some((e) => e.type === "text"));
  assert.ok(events.some((e) => e.type === "learner"), "the class ends with the Learner pipeline");
});

test("a class on a layer drawn from the code teaches how to read it and makes no proposals", async () => {
  const t = await newCore();
  launches.length = 0;
  await t.events(await t.post("/tutor/classes", { project, layer: "components" }));
  const tutor = launches.find((l) => l.role === "tutor")!;
  assert.match(tutor.message, /components layer/i);
  assert.match(tutor.message, /drawn from the code/i);
  assert.doesNotMatch(tutor.message, /propose_node/);
});

test("an unknown layer is refused naming the layers", async () => {
  const t = await newCore();
  const res = await t.post("/tutor/classes", { project, layer: "code" });
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /business, requirements, architecture, components, flow/);
});

test("the Data layer's content says it is drawn from the code by Playback, that nobody writes it and what each part of the drawing is", async () => {
  const { help } = await newCore();
  const data = (await help()).layers.data;
  assert.equal(data.name, "Data");
  assert.match(data.what, /Playback/);
  assert.match(data.what, /never written|nobody writes|drawn from the code/i);
  assert.deepEqual(data.order, ["variable", "list", "dictionary", "change", "limit"]);
  assert.match(data.elements.change.what, /highlight/i);
  assert.match(data.elements.limit.what, /more hidden/i);
});

test("a class on the Data layer is a class on a derived layer: the Tutor makes no proposals", async () => {
  const t = await newCore();
  launches.length = 0;
  const res = await t.post("/tutor/classes", { project, layer: "data" });
  assert.equal(res.status, 200);
  await res.text();
  const tutor = launches.find((l) => l.role === "tutor")!;
  assert.match(tutor.message, /drawn from the code/);
  assert.match(tutor.message, /make no proposals/);
});
