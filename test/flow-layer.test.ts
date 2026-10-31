import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, test } from "node:test";
import { fixture, startTestCore } from "./helpers.ts";

const t = await startTestCore();
after(() => t.core.close());

test("the layer that draws the flowchart of a function is called Flow, and no layer is called Algorithms", async () => {
  const { layers } = (await (await t.get("/layers/help")).json()) as { layers: Record<string, { name: string }> };
  assert.equal(layers.flow?.name, "Flow");
  assert.equal(layers.algorithms, undefined);
  assert.deepEqual(Object.keys(layers), ["business", "requirements", "architecture", "components", "flow"]);
});

test("the flowchart of a function is served at /flow and the old path is gone", async () => {
  await t.post("/projects", { path: fixture("flow") });
  const q = `project=${encodeURIComponent(fixture("flow"))}&node=symbols.tour`;
  assert.equal((await t.get(`/flow?${q}`)).status, 200);
  assert.equal((await t.get(`/algorithm?${q}`)).status, 404);
});

test("a Tutor class can be opened on the Flow layer and not on Algorithms", async () => {
  assert.equal((await t.post("/tutor/classes", { project: fixture("flow"), layer: "algorithms" })).status, 400);
});

// Text a person or the Tutor reads must not call the layer by its old name. The right-slot tab (renamed Run in ticket 02) is not the layer.
test("user-facing text never names the layer Algorithms or the graph an Algorithm graph", () => {
  const src = join(import.meta.dirname, "..", "src");
  const files = [
    join(src, "core", "layer-help.ts"),
    join(src, "core", "guide.ts"),
    join(src, "core", "routes", "flow.ts"),
    join(src, "ui", "index.html"),
    ...readdirSync(join(src, "ui", "features")).map((f) => join(src, "ui", "features", f)),
  ];
  const found: string[] = [];
  for (const file of files) {
    readFileSync(file, "utf8").split("\n").forEach((line, i) => {
      const code = line.replace(/\s\/\/.*$/, ""); // comments are for maintainers, not for the person
      if (code.trim().startsWith("//")) return;
      if (/Algorithm graph|Algorithms layer|"Algorithms"\s*,\s*\{|textContent = "Algorithms"/.test(code)) found.push(`${file.slice(src.length + 1)}:${i + 1}: ${line.trim().slice(0, 120)}`);
    });
  }
  assert.deepEqual(found, [], `old layer name in text:\n${found.join("\n")}`);
});
