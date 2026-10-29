import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apply, io } from "../src/core/proposals.ts";
import type { Proposal } from "../src/core/proposals.ts";
import type { Project } from "../src/core/types.ts";

const why = { why: "Because.", rejected: [{ option: "Else", reason: "Worse." }] };
const story = (id: string, want = "a form") => ({ id, title: id, as: "owner", want, so: "I get a price", traces: [], rationale: why });
const text = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

function setup(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "aidea-rollback-"));
  for (const [rel, body] of Object.entries(files)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  const project = { id: "p", name: "p", path: dir } as Project;
  const snapshot = () => Object.fromEntries(Object.keys(files).map((r) => [r, existsSync(join(dir, r)) ? readFileSync(join(dir, r), "utf8") : null]));
  return { dir, project, snapshot, done: () => rmSync(dir, { recursive: true, force: true }) };
}
const update = (nodeId: string, changes: Record<string, unknown>): Proposal =>
  ({ id: "x", project: "p", layer: "requirements", kind: "update", nodeId, changes, status: "pending" });

test("a failed readback puts the old bytes of an updated file back", () => {
  const old = text(story("a"));
  const s = setup({ ".aidea/requirements/001-a.json": old });
  const read = io.read;
  io.read = (p) => (p.endsWith("001-a.json") ? "garbage" : read(p));
  try {
    assert.match(apply(s.project, update("a", { want: "new" }))!, /nothing was changed/);
  } finally { io.read = read; }
  assert.deepEqual(s.snapshot(), { ".aidea/requirements/001-a.json": old });
  s.done();
});

test("a failed removal of the old single file puts back a deleted Node's file", () => {
  const a = text(story("a"));
  const single = JSON.stringify({ nodes: [story("b")] });
  const s = setup({ ".aidea/requirements/001-a.json": a, ".aidea/requirements.json": single });
  const unlink = io.unlink;
  io.unlink = (p) => { if (p.endsWith("requirements.json")) throw new Error("locked"); unlink(p); };
  try {
    const gone: Proposal = { id: "x", project: "p", layer: "requirements", kind: "remove", nodeId: "a", status: "pending" };
    assert.match(apply(s.project, gone)!, /nothing was changed/);
  } finally { io.unlink = unlink; }
  assert.deepEqual(s.snapshot(), { ".aidea/requirements/001-a.json": a, ".aidea/requirements.json": single });
  s.done();
});

test("a failure after the old single file went puts it back and removes the new files", () => {
  const single = JSON.stringify({ nodes: [story("a"), story("b")] });
  const s = setup({ ".aidea/requirements.json": single });
  const unlink = io.unlink;
  io.unlink = (p) => { unlink(p); throw new Error("late"); };
  try {
    assert.match(apply(s.project, update("a", { want: "new" }))!, /nothing was changed/);
  } finally { io.unlink = unlink; }
  assert.deepEqual(s.snapshot(), { ".aidea/requirements.json": single });
  assert.equal(existsSync(join(s.dir, ".aidea/requirements/001-a.json")), false);
  assert.equal(existsSync(join(s.dir, ".aidea/requirements/002-b.json")), false);
  s.done();
});
