import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { begin, finish, restore } from "../src/core/guard.ts";

const project = () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-guardmem-"));
  mkdirSync(join(dir, ".aidea"));
  writeFileSync(join(dir, ".aidea", "a.json"), "one");
  return dir;
};
// A turn in which the builder rewrites a.json; returns the id to restore it by.
const changedTurn = (dir: string, body: string) => {
  const turn = begin(dir);
  writeFileSync(join(dir, ".aidea", "a.json"), body);
  return finish(turn)!.id;
};

test("the way back of a turn is dropped once the next turn of that Project begins", () => {
  const dir = project();
  const id = changedTurn(dir, "two");
  finish(begin(dir));
  assert.equal(restore(id), null);
  rmSync(dir, { recursive: true, force: true });
});

test("only a few ways back are kept: the oldest goes first", () => {
  const dirs = Array.from({ length: 30 }, project);
  const ids = dirs.map((d) => changedTurn(d, "two"));
  assert.equal(restore(ids[0]), null);
  assert.deepEqual(restore(ids[29])?.restored, [".aidea/a.json"]);
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

test("restore does not write through a link at the target", (t) => {
  const dir = project();
  const outside = mkdtempSync(join(tmpdir(), "aidea-outside-"));
  writeFileSync(join(outside, "secret"), "keep");
  const turn = begin(dir);
  rmSync(join(dir, ".aidea", "a.json"));
  const id = finish(turn)!.id; // the turn removed the file; a link now sits where it was
  try { symlinkSync(join(outside, "secret"), join(dir, ".aidea", "a.json")); } catch { t.skip("links cannot be made here"); return; }
  assert.deepEqual(restore(id)?.skipped, [".aidea/a.json"]);
  assert.equal(readFileSync(join(outside, "secret"), "utf8"), "keep");
  rmSync(dir, { recursive: true, force: true });
  rmSync(outside, { recursive: true, force: true });
  assert.ok(!existsSync(dir));
});
