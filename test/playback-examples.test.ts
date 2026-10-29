import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const project = fixture("playback-tests");
before(async () => {
  t = await startTestCore();
  await t.post("/projects", { path: project });
});
after(() => t.core.close());

const examples = (node: string) => t.get(`/playback/examples?project=${encodeURIComponent(project)}&node=${encodeURIComponent(node)}`);

test("a test that calls the function offers its literal arguments as ready-made inputs, by parameter name", async () => {
  const res = await examples("ops.drain");
  assert.equal(res.status, 200);
  const { examples: found } = await res.json();
  assert.deepEqual(found, [
    { source: "tests/test_ops.py:7", values: { total: "130" } },
    { source: "tests/test_ops.py:11", values: { total: "250", step: "50" } },
  ]);
});

test("a function whose tests only pass arguments that cannot be read offers nothing", async () => {
  const res = await examples("ops.scale");
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).examples, []);
});

test("unknown projects and nodes are refused in plain words", async () => {
  assert.equal((await examples("ops.nothing")).status, 404);
  assert.equal((await t.get("/playback/examples?project=nope&node=x")).status, 404);
});
