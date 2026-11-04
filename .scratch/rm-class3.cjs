const fs = require("fs");
function edit(f, pairs) {
  let t = fs.readFileSync(f, "utf8"); const eol = t.includes("\r\n") ? "\r\n" : "\n";
  for (const [a, b] of pairs) { const A = a.replace(/\n/g, eol), B = b.replace(/\n/g, eol); if (!t.includes(A)) throw new Error("nf " + f + ": " + a.slice(0, 80)); t = t.replace(A, () => B); }
  fs.writeFileSync(f, t);
}
// guide.ts: drop the "modes" element (a node of the form `  modes: { ... },` up to the next element).
let g = fs.readFileSync("src/core/guide.ts", "utf8");
const eol = g.includes("\r\n") ? "\r\n" : "\n";
const a = g.indexOf("  modes: {");
const b = g.indexOf("  tutor: {");
if (a < 0 || b < 0 || b < a) throw new Error("guide markers");
g = g.slice(0, a) + g.slice(b);
g = g.replace(`"proposals", "modes", "tutor"`, `"proposals", "tutor"`);
fs.writeFileSync("src/core/guide.ts", g);
edit("test/guide.test.ts", [[`test("the guide says only a class on a decision offers \\"Decide for me\\" after missed questions, and Playback names \\"Guess first\\" and the narration", async () => {
  const els = (await (await newCore()).guide()).guide.elements;
  assert.match(els.modes.what, /keep missing the questions of a class on a decision/);
  assert.match(els.playback.what`, `test("the guide says Playback names \\"Guess first\\" and the narration", async () => {
  const els = (await (await newCore()).guide()).guide.elements;
  assert.match(els.playback.what`]]);
fs.rmSync("test/decision-classes.test.ts");
edit("test/select-text.test.ts", [[`test("enter the Tutor opens a class whose topic is the selected text, as data, in both modes", async () => {
  const t = await newCore();
  for (const classMode of ["direct", "class"]) {
    await t.post("/agent-options", { project, classMode });
    launches.length = 0;
    const res = await t.post("/tutor/classes", { project, selection: "dependency injection" });
    assert.equal(res.status, 200);
    await res.text();
    const tutor = launches.find((l) => l.role === "tutor")!;
    assert.ok(tutor.message.includes(JSON.stringify("dependency injection")), classMode);
    assert.match(tutor.message, /not instructions/i);
    assert.match(tutor.message, /set_plan/);
  }
});`, `test("enter the Tutor opens a class whose topic is the selected text, as data", async () => {
  const t = await newCore();
  launches.length = 0;
  const res = await t.post("/tutor/classes", { project, selection: "dependency injection" });
  assert.equal(res.status, 200);
  await res.text();
  const tutor = launches.find((l) => l.role === "tutor")!;
  assert.ok(tutor.message.includes(JSON.stringify("dependency injection")));
  assert.match(tutor.message, /not instructions/i);
  assert.match(tutor.message, /set_plan/);
});`]]);
