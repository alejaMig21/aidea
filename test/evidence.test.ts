import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { loadAuthored } from "../src/core/authored.ts";
import { apply, propose } from "../src/core/proposals.ts";
import type { ProposalStore } from "../src/core/proposals.ts";

// layer-inference 03: a Proposal can carry `evidence` (a status and cited files and lines); the core refuses a citation that does not hold.
const scratch = mkdtempSync(join(tmpdir(), "aidea-evidence-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

const why = { why: "Because.", rejected: [{ option: "Else", reason: "Worse." }] };
let n = 0;
function project() {
  const path = join(scratch, `p${n++}`);
  mkdirSync(join(path, "src"), { recursive: true });
  writeFileSync(join(path, "src", "app.py"), Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n") + "\n");
  return { id: `proj-${n}`, path, name: "p", nodes: [], errors: [], relationships: [], unresolved: 0 } as any;
}
const node = (evidence?: unknown, id = "web") => ({ id, title: "Web app", technology: "Node", kind: "container", rationale: why, ...(evidence === undefined ? {} : { evidence }) });
const add = (p: any, evidence?: unknown, id?: string, store: ProposalStore = new Map()) => propose(store, p, "s", "add", { layer: "architecture", node: node(evidence, id) });
const refused = (r: any) => ("error" in r ? r.error : "");

test("a Proposal whose citations exist is accepted, and the evidence stays on the Node once the person accepts it", () => {
  const p = project();
  const evidence = { status: "observed", cites: [{ file: "src/app.py", from: 3, to: 12 }] };
  const r = add(p, evidence) as any;
  assert.ok(r.proposal, refused(r));
  assert.equal(apply(p, r.proposal), null);
  assert.deepEqual(loadAuthored(p.path).layers.architecture.nodes[0].evidence, evidence);
});

test("a citation to a file that is not there is refused, naming the citation", () => {
  const e = refused(add(project(), { status: "inferred", cites: [{ file: "src/missing.py", from: 1, to: 2 }] }));
  assert.match(e, /src\/missing\.py/);
  assert.match(e, /does not exist/i);
});

test("a citation to lines past the end of the file is refused, saying how long the file is", () => {
  const e = refused(add(project(), { status: "observed", cites: [{ file: "src/app.py", from: 10, to: 40 }] }));
  assert.match(e, /src\/app\.py/);
  assert.match(e, /10-40/);
  assert.match(e, /12 lines/);
});

test("a citation that leaves the Project, or is a folder, is refused", () => {
  assert.match(refused(add(project(), { status: "observed", cites: [{ file: "../secret.txt", from: 1, to: 1 }] })), /inside the Project/);
  assert.match(refused(add(project(), { status: "observed", cites: [{ file: join(scratch, "x.py"), from: 1, to: 1 }] })), /inside the Project/);
  assert.match(refused(add(project(), { status: "observed", cites: [{ file: "src", from: 1, to: 1 }] })), /not a file|does not exist/i);
});

test("unknown may carry no citation but must say why; observed and inferred need a citation", () => {
  assert.ok((add(project(), { status: "unknown", why: "The code does not say who pays." }) as any).proposal);
  assert.match(refused(add(project(), { status: "unknown" })), /"evidence\.why"/);
  assert.match(refused(add(project(), { status: "observed", cites: [] })), /"evidence\.cites"/);
  assert.match(refused(add(project(), { status: "inferred" })), /"evidence\.cites"/);
});

test("the shape of the evidence is checked: status, lines and the number of citations", () => {
  const cite = { file: "src/app.py", from: 1, to: 2 };
  assert.match(refused(add(project(), { status: "maybe", cites: [cite] })), /"evidence\.status"/);
  assert.match(refused(add(project(), { status: "observed", cites: [{ ...cite, from: 5, to: 2 }] })), /"evidence\.cites\[0\]"/);
  assert.match(refused(add(project(), { status: "observed", cites: [{ ...cite, from: 0 }] })), /"evidence\.cites\[0\]"/);
  assert.match(refused(add(project(), { status: "observed", cites: Array.from({ length: 21 }, () => cite) })), /"evidence\.cites"/);
  assert.match(refused(add(project(), "observed")), /"evidence"/);
});

test("evidence is optional: a Node without it, as the person writes them, is accepted", () => {
  assert.ok((add(project()) as any).proposal);
});

test("an update that changes the evidence is checked like an add; an update that leaves it alone is not asked for any", () => {
  const p = project();
  const store: ProposalStore = new Map();
  const first = add(p, { status: "observed", cites: [{ file: "src/app.py", from: 1, to: 2 }] }, "web", store) as any;
  apply(p, first.proposal);
  const bad = propose(new Map(), p, "s", "update", { layer: "architecture", id: "web", changes: { evidence: { status: "observed", cites: [{ file: "src/nope.py", from: 1, to: 1 }] } } });
  assert.match(refused(bad), /src\/nope\.py/);
  const fine = propose(new Map(), p, "s", "update", { layer: "architecture", id: "web", changes: { description: "Serves the form." } });
  assert.ok((fine as any).proposal, refused(fine));
});

test("evidence written by hand in a layer file is checked for its shape, and the Node is dropped with the problem named", () => {
  const p = project();
  mkdirSync(join(p.path, ".aidea"), { recursive: true });
  writeFileSync(join(p.path, ".aidea", "architecture.json"), JSON.stringify({ nodes: [node({ status: "unknown" }, "bad"), node({ status: "unknown", why: "Not in the code." }, "good")] }));
  const layer = loadAuthored(p.path).layers.architecture;
  assert.deepEqual(layer.nodes.map((x: any) => x.id), ["good"]);
  assert.match(layer.errors.map((e: any) => e.message).join("\n"), /evidence\.why/);
});
