import { test, before, after } from "node:test";
import assert from "node:assert/strict";

// Python cannot start in this process, so reading any folder fails inside the analysis.
process.env.AIDEA_PYTHON = "no-such-python-for-this-test";
const { fixture, startTestCore } = await import("./helpers.ts");

let t: Awaited<ReturnType<typeof startTestCore>>;
before(async () => {
  t = await startTestCore();
});
after(() => t.core.close());

test("when the analysis fails, the person gets a sentence that says what to try", async () => {
  const res = await t.post("/projects", { path: fixture("shop") });
  assert.equal(res.status, 500);
  const { error } = await res.json();
  assert.match(error, /^Could not read this project/);
  assert.match(error, /Try /);
});

test("a path that is not a folder says what to try", async () => {
  const res = await t.post("/projects", { path: fixture("shop") + "/no-such-folder" });
  assert.equal(res.status, 400);
  const { error } = await res.json();
  assert.match(error, /folder/);
  assert.match(error, /Try /);
});
