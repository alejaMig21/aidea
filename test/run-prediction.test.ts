import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fixture, startTestCore } from "./helpers.ts";

let t: Awaited<ReturnType<typeof startTestCore>>;
const project = fixture("playback");
let rec: { id: string; visits: { step: string; locals: Record<string, string> }[] };
before(async () => {
  t = await startTestCore();
  await t.post("/projects", { path: project });
  rec = await (await t.post("/playback", { project, node: "ops.drain", args: [130] })).json();
});
after(() => t.core.close());

const ask = (step: number, id = rec.id) => t.get(`/playback/predict?id=${id}&step=${step}`);
// The first step after which some value changes: the recording itself says what the answer is.
const changing = () => rec.visits.findIndex((v, i) => rec.visits[i + 1] && Object.entries(rec.visits[i + 1].locals).some(([k, x]) => v.locals[k] !== x));

test("the question names a value that changes next and never carries the answer", async () => {
  const i = changing();
  const res = await ask(i);
  assert.equal(res.status, 200);
  const text = await res.text();
  const q = JSON.parse(text);
  assert.match(q.prompt, new RegExp(`^After this step, what will \`${q.name}\` be\\?$`));
  assert.ok(!("correct" in q) && !("answer" in q) && !/correct/.test(text));
  const truth = rec.visits[i + 1].locals[q.name];
  assert.equal(q.options.filter((o: string) => o === truth).length, 1); // the true value, exactly once
  assert.ok(q.options.length >= 2);
  assert.equal(new Set(q.options).size, q.options.length);
});

test("the options are the same every time for a recording and come from values the run showed", async () => {
  const i = changing();
  const [a, b] = [await (await ask(i)).json(), await (await ask(i)).json()];
  assert.deepEqual(a, b);
  const seen = new Set(rec.visits.flatMap((v) => Object.values(v.locals)));
  for (const o of a.options) assert.ok(seen.has(o), `${o} was never in the recording`);
});

test("a step with nothing to ask, the last step and unknown places are refused, not invented", async () => {
  assert.equal((await ask(rec.visits.length - 1)).status, 422);
  assert.equal((await ask(-1)).status, 422);
  assert.equal((await ask(0, "pb-nope")).status, 404);
  assert.equal((await t.post("/playback/predict", { id: "pb-nope", step: 0, option: 0 })).status, 404);
});

test("a right and a wrong guess are recorded as Evidence about the run, never in the Learner graph", async () => {
  const i = changing();
  const q = await (await ask(i)).json();
  const truth = rec.visits[i + 1].locals[q.name];
  const right = await t.post("/playback/predict", { id: rec.id, step: i, option: q.options.indexOf(truth), confidence: 70, thought: "it goes down by ten" });
  assert.equal(right.status, 200);
  assert.deepEqual(await right.json(), { correct: true, name: q.name, answer: truth });
  const wrongIndex = q.options.findIndex((o: string) => o !== truth);
  const wrong = await (await t.post("/playback/predict", { id: rec.id, step: i, option: wrongIndex, confidence: 90 })).json();
  assert.equal(wrong.correct, false);
  assert.equal(wrong.answer, truth);

  const { entries } = await (await t.get(`/learner/evidence?class=run:${rec.id}`)).json();
  assert.equal(entries.length, 2);
  assert.deepEqual(
    { kind: entries[0].kind, correct: entries[0].correct, confidence: entries[0].confidence, answer: entries[0].answer, thought: entries[0].thought, project: entries[0].project, run: entries[0].run },
    { kind: "run-prediction", correct: true, confidence: 70, answer: truth, thought: "it goes down by ten", project, run: { recording: rec.id, step: i, name: q.name } },
  );
  assert.equal(entries[1].correct, false);
  assert.equal(entries[1].sureAndWrong, true);
  const graph = await (await t.get("/learner/graph")).json();
  assert.deepEqual(graph.propositions, []);
});

test("an answer that is not one of the options, or has a made-up confidence, is refused and records nothing", async () => {
  const before = (await (await t.get(`/learner/evidence?class=run:${rec.id}`)).json()).entries.length;
  const i = changing();
  for (const body of [{ option: 99 }, { option: -1 }, { option: "0" }, {}, { option: 0, confidence: 42 }, { option: 0, thought: 7 }]) {
    assert.equal((await t.post("/playback/predict", { id: rec.id, step: i, ...body })).status, 400, JSON.stringify(body));
  }
  assert.equal((await t.post("/playback/predict", { id: rec.id, step: rec.visits.length - 1, option: 0 })).status, 422);
  assert.equal((await (await t.get(`/learner/evidence?class=run:${rec.id}`)).json()).entries.length, before);
});
