import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { readManifest } from "../src/core/plugins/manifest.ts";
import { scanPlugin } from "../src/core/plugins/scan.ts";

// plugin-teaching 01: the manifest can declare a teaching surface, `teach`: the name of a read-only view and a list of named checks.
const scratch = mkdtempSync(join(tmpdir(), "aidea-plugin-teach-"));
after(() => rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }));

const check = (over: Record<string, unknown> = {}) => ({ name: "has-container", says: "A container with a relation to a database exists.", args: { node: "string" }, ...over });
const teach = (over: Record<string, unknown> = {}) => ({ view: "state", checks: [check()], ...over });
let n = 0;
function plugin(teachField: unknown) {
  const dir = join(scratch, `p${n++}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "aidea-plugin.json"), JSON.stringify({ id: "fixture.teach", version: "1.0.0", title: "Teach", description: "A fixture.", publisher: "tests", api: "0.1", ui: "ui.js", ...(teachField === undefined ? {} : { teach: teachField }) }));
  writeFileSync(join(dir, "ui.js"), "// nothing");
  return dir;
}
const problems = (t: unknown) => { const r = readManifest(plugin(t)); return "problems" in r ? r.problems.join("; ") : ""; };

test("a manifest with a valid teach field loads, and a plugin without one is unchanged", () => {
  const ok = readManifest(plugin(teach()));
  assert.ok("manifest" in ok, JSON.stringify(ok));
  assert.deepEqual(ok.manifest.teach, teach());
  assert.equal(problems(teach({ checks: [] })), "", "a view with no checks is allowed");
  assert.equal(problems(teach({ checks: [check({ args: undefined })] })), "", "arguments are optional");
  const none = readManifest(plugin(undefined));
  assert.ok("manifest" in none && none.manifest.teach === undefined);
});

test("a teach field that does not have the shape is refused with the field named", () => {
  assert.match(problems("state"), /"teach".*object/);
  assert.match(problems({ checks: [] }), /"teach".*"view"/);
  assert.match(problems(teach({ view: "Not A Name" })), /"teach".*"view"/);
  assert.match(problems(teach({ checks: "x" })), /"teach".*"checks"/);
  assert.match(problems(teach({ checks: Array.from({ length: 21 }, (_, i) => check({ name: `c${i}` })) })), /"teach".*"checks"/);
  assert.match(problems(teach({ checks: [check({ says: "" })] })), /"teach".*check "has-container".*"says"/);
  assert.match(problems(teach({ checks: [check({ says: undefined })] })), /"says"/);
  assert.match(problems(teach({ checks: [check({ says: "x".repeat(300) })] })), /"says"/);
  assert.match(problems(teach({ checks: [check({ name: "Bad Name" })] })), /"teach".*"name"/);
  assert.match(problems(teach({ checks: [check(), check()] })), /"teach".*"has-container".*twice/);
  assert.match(problems(teach({ checks: [check({ args: ["node"] })] })), /"args"/);
  assert.match(problems(teach({ checks: [check({ args: { node: "object" } })] })), /"args".*"node"/);
  assert.match(problems(teach({ checks: [check({ args: Object.fromEntries(Array.from({ length: 6 }, (_, i) => [`a${i}`, "string"])) })] })), /"args"/);
});

test("the scan lists the view and the checks among what the plugin declares", () => {
  const report = scanPlugin(plugin(teach()));
  assert.equal(report.manifest?.teach?.view, "state");
  assert.deepEqual(report.manifest?.teach?.checks.map((c) => c.name), ["has-container"]);
  const bad = scanPlugin(plugin(teach({ checks: [check({ says: "" })] })));
  assert.ok(bad.findings.some((f) => f.id === "invalid-manifest" && /"says"/.test(f.message)));
});
