import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { projectPython } from "../src/core/python.ts";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const project = fixture("playback");
const scratch: string[] = [];
before(async () => {
  t = await startTestCore();
  await t.post("/projects", { path: project });
});
after(() => {
  t.core.close();
  rmSync(join(project, "blocked.txt"), { force: true }); // only exists if the safety net failed
  rmSync(join(project, "x.txt"), { force: true });
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

type Entry = { step: string; locals: Record<string, string> };
const record = (node: string, body: Record<string, unknown> = {}) => t.post("/playback", { project, node, ...body });
const labelsOf = async (node: string) => {
  const g = await (await t.get(`/algorithm?project=${encodeURIComponent(project)}&node=${encodeURIComponent(node)}`)).json();
  const label = new Map<string, string>(g.steps.map((s: { id: string; label: string }) => [s.id, s.label]));
  return (entry: Entry) => label.get(entry.step);
};

test("choosing a pure function and inputs records the steps it went through and the values on arrival", async () => {
  const res = await record("ops.drain", { args: [130] });
  assert.equal(res.status, 201);
  const rec = await res.json();
  const label = await labelsOf("ops.drain");
  assert.deepEqual(rec.visits.map(label), [
    "drain(total)",
    "steps = 0",
    "while total > 100",
    "total -= 10",
    "steps += 1",
    "while total > 100",
    "total -= 10",
    "steps += 1",
    "while total > 100",
    "total -= 10",
    "steps += 1",
    "while total > 100",
    "return steps",
    "end",
  ]);
  assert.equal(rec.result, "3");
  assert.deepEqual(rec.visits[0].locals, { total: "130" }); // the arguments
  assert.deepEqual(rec.visits[1].locals, { total: "130" }); // `steps` does not exist yet
  assert.deepEqual(rec.visits[11].locals, { total: "100", steps: "3" }); // the fourth time the loop condition is checked
  assert.equal(rec.error, undefined);
  assert.equal(rec.truncated, false);
});

test("a method is played on an instance built from the given constructor arguments", async () => {
  const rec = await (await record("ops.Counter.bump", { instance: { args: [5] }, args: [2] })).json();
  assert.equal(rec.result, "7");
  assert.equal(rec.visits[0].locals.by, "2");
});

test("a function that prints has its output kept in the recording", async () => {
  const rec = await (await record("ops.greet", { args: ["Ada"] })).json();
  assert.equal(rec.output, "hello Ada\n");
  assert.equal(rec.result, "3");
});

test("a function with external effects is refused, naming the call and its line", async () => {
  const res = await record("ops.save", { args: ["x"] });
  assert.equal(res.status, 422);
  const body = await res.json();
  assert.match(body.error, /open/);
  assert.deepEqual(body.effects, [{ name: "open", line: 26 }]);
  assert.equal(existsSync(join(project, "x.txt")), false);
});

test("an external effect that is replaced by fake data lets the function play", async () => {
  const rec = await (await record("ops.load", { args: ["anything.txt"], fakes: { open: "file text" } })).json();
  assert.equal(rec.result, "'file text'");
});

test("an effect hidden inside a helper is stopped while running, and nothing is written", async () => {
  const res = await record("ops.indirect");
  assert.equal(res.status, 201);
  const rec = await res.json();
  assert.equal(rec.error.type, "PermissionError");
  assert.match(rec.error.message, /blocked/);
  assert.equal(existsSync(join(project, "blocked.txt")), false);
});

test("replaying a recording gives the same result every time without running the code again", async () => {
  const first = await (await record("ops.jitter", { args: [1] })).json();
  const again = await (await t.get(`/playback?id=${encodeURIComponent(first.id)}`)).json();
  const andAgain = await (await t.get(`/playback?id=${encodeURIComponent(first.id)}`)).json();
  assert.deepEqual(again, first);
  assert.deepEqual(andAgain, first);
  // A new recording is a new run: the random number differs, so the replays above were not re-runs.
  const second = await (await record("ops.jitter", { args: [1] })).json();
  assert.notEqual(second.result, first.result);
});

test("a function that raises is recorded up to the failure", async () => {
  const res = await record("ops.divide", { args: [1, 0] });
  assert.equal(res.status, 201);
  const rec = await res.json();
  assert.equal(rec.error.type, "ZeroDivisionError");
  const label = await labelsOf("ops.divide");
  assert.deepEqual(rec.visits.map(label), ["divide(a, b)", "return a / b"]);
});

test("a function that never ends is stopped and the recording says it is cut short", async () => {
  const rec = await (await record("ops.forever")).json();
  assert.equal(rec.truncated, true);
  assert.equal(rec.visits.length, 2000); // the limit on recorded steps
});

test("an effect hidden behind an import alias is still refused before running", async () => {
  const res = await record("ops.aliased");
  assert.equal(res.status, 422);
  assert.deepEqual((await res.json()).effects, [{ name: "o.remove", line: 93 }]);
});

test("a function may read files of its own Project but not files elsewhere", async () => {
  const outside = mkdtempSync(join(tmpdir(), "aidea-secret-"));
  scratch.push(outside);
  writeFileSync(join(outside, "secret.txt"), "do not show");
  const blocked = await (await record("ops.peek_outside", { args: [join(outside, "secret.txt")] })).json();
  assert.equal(blocked.error.type, "PermissionError");
  assert.match(blocked.error.message, /outside the project/);
  const allowed = await (await record("ops.peek_inside")).json();
  assert.equal(allowed.result, "'inside data\\n'");
});

test("calling native code is stopped while running", async () => {
  const rec = await (await record("ops.native")).json();
  assert.equal(rec.error.type, "PermissionError");
  assert.match(rec.error.message, /blocked/);
});

test("generators and async functions are refused with a clear message", async () => {
  const res = await record("ops.gen");
  assert.equal(res.status, 422);
  assert.match((await res.json()).error, /generator/i);
});

test("a recursive function is recorded for its outermost call only", async () => {
  const rec = await (await record("ops.fact", { args: [3] })).json();
  const label = await labelsOf("ops.fact");
  assert.deepEqual(rec.visits.map(label), ["fact(n)", "if n <= 1", "return n * fact(n - 1)", "end"]);
  assert.equal(rec.result, "6");
});

test("a run that takes too long is stopped with a clear message", { timeout: 20_000 }, async () => {
  process.env.AIDEA_PLAYBACK_TIMEOUT_MS = "1500";
  try {
    const started = Date.now();
    const res = await record("ops.slow");
    assert.equal(res.status, 504);
    assert.match((await res.json()).error, /too long/);
    assert.ok(Date.now() - started < 10_000);
  } finally {
    delete process.env.AIDEA_PLAYBACK_TIMEOUT_MS;
  }
});

test("the person's own virtual environment is used only when asked for, and the recording says which Python ran", async () => {
  const first = await (await record("ops.drain", { args: [130] })).json();
  assert.equal(first.interpreter, "default");

  const bare = mkdtempSync(join(tmpdir(), "aidea-bare-"));
  scratch.push(bare);
  cpSync(project, bare, { recursive: true });
  await t.post("/projects", { path: bare });
  const refused = await t.post("/playback", { project: bare, node: "ops.drain", args: [130], useProjectPython: true });
  assert.equal(refused.status, 422);
  assert.match((await refused.json()).error, /virtual environment/);

  execFileSync(process.env.AIDEA_PYTHON ?? "python", ["-m", "venv", "--without-pip", join(bare, ".venv")]);
  const used = await t.post("/playback", { project: bare, node: "ops.drain", args: [130], useProjectPython: true });
  assert.equal(used.status, 201);
  const rec = await used.json();
  assert.equal(rec.result, "3");
  assert.ok(rec.interpreter.includes(".venv"));
});

const bareCopy = async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-bare-"));
  scratch.push(dir);
  cpSync(project, dir, { recursive: true });
  await t.post("/projects", { path: dir });
  return dir;
};

test("a Project with a virtual environment plays with it by default, and the person can opt out", async () => {
  const dir = await bareCopy();
  execFileSync(process.env.AIDEA_PYTHON ?? "python", ["-m", "venv", "--without-pip", join(dir, "venv")]);
  const auto = await (await t.post("/playback", { project: dir, node: "ops.drain", args: [130] })).json();
  assert.equal(auto.result, "3");
  assert.ok(auto.interpreter.startsWith(join(dir, "venv")));
  const optedOut = await (await t.post("/playback", { project: dir, node: "ops.drain", args: [130], useProjectPython: false })).json();
  assert.equal(optedOut.interpreter, "default");
});

test("a folder called env is not taken for the Project's virtual environment: only .venv and venv are", async () => {
  const dir = await bareCopy();
  execFileSync(process.env.AIDEA_PYTHON ?? "python", ["-m", "venv", "--without-pip", join(dir, "env")]);
  const rec = await (await t.post("/playback", { project: dir, node: "ops.drain", args: [130] })).json();
  assert.equal(rec.interpreter, "default");
  const refused = await t.post("/playback", { project: dir, node: "ops.drain", args: [130], useProjectPython: true });
  assert.equal(refused.status, 422);
});

test("a virtual environment whose interpreter does not work is reported in words", async () => {
  const dir = await bareCopy();
  const win = process.platform === "win32";
  const fake = join(dir, ".venv", win ? "Scripts" : "bin", win ? "python.exe" : "python");
  mkdirSync(join(fake, ".."), { recursive: true });
  if (win) copyFileSync(process.execPath, fake); // a real program that is not Python
  else { writeFileSync(fake, "#!/bin/sh\necho 'broken environment' >&2\nexit 1\n"); chmodSync(fake, 0o755); }
  const res = await t.post("/playback", { project: dir, node: "ops.drain", args: [130] });
  assert.equal(res.status, 422);
  assert.match((await res.json()).error, /interpreter .*\.venv.* did not run/);
});

test("the Project's interpreter is found only at the usual places inside the Project folder", () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-find-"));
  scratch.push(dir);
  assert.equal(projectPython(dir), undefined);
  for (const [folder, exe] of [["venv", "bin/python"], [".venv", "Scripts/python.exe"]]) {
    mkdirSync(join(dir, folder, exe, ".."), { recursive: true });
    writeFileSync(join(dir, folder, exe), "");
  }
  assert.equal(projectPython(dir), join(dir, ".venv", "Scripts", "python.exe")); // .venv wins over venv
});

test("asking to play with bad input gives clear errors", async () => {
  assert.equal((await record("ops.drain", { args: "130" })).status, 400);
  assert.equal((await record("ops.drain", { fakes: { "not a name!": 1 } })).status, 400);
  assert.equal((await record("ops.nope")).status, 404);
  assert.equal((await t.post("/playback", { project: project + "-never-opened", node: "ops.drain" })).status, 404);
  const notAFunction = await record("ops.Counter");
  assert.equal(notAFunction.status, 422);
  assert.match((await notAFunction.json()).error, /function/);
  assert.equal((await t.get("/playback?id=pb-none")).status, 404);
});
