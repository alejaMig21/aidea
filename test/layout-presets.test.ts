import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { startCore } from "../src/core/server.ts";
import { fixture } from "./helpers.ts";

// Layout presets (layout-and-data 09): the person saves the current Layout under a name, switches, renames and deletes their own; three built-ins cannot be overwritten or deleted.
// The core keeps the user's presets in the per-user preferences file (key "~ui"), never inside a Project. The page does the arranging; the core checks and remembers.
const cores: { close(): void }[] = [];
after(() => { for (const c of cores) try { c.close(); } catch { /* already closed */ } });
const saved = (html: string) => JSON.parse(decodeURIComponent(/<meta name="aidea-saved" content="([^"]*)">/.exec(html)![1]));
const builtIns = (html: string) => JSON.parse(decodeURIComponent(/<meta name="aidea-presets" content="([^"]*)">/.exec(html)![1]));
const put = (url: string, name: string, body: unknown) => fetch(`${url}/ui/${name}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
// A body past the core's size limit is refused before it is read (413); anything else wrong is a 400. Both are "refused".
const refused = (status: number) => status === 400 || status === 413;
const state = (extra: object = {}) => ({ chatFolded: false, runFolded: true, dock: { grid: { root: { type: "leaf" } } }, ...extra });

test("the page is served with the names of the built-in presets, and the classic IDE arrangement is not the default", async () => {
  const core = await startCore({ port: 0 });
  try {
    const info = builtIns(await (await fetch(core.url + "/")).text());
    assert.deepEqual(info.names, ["Default", "Classic IDE", "Canvas only"]);
    assert.equal(info.default, "Default");
  } finally { core.close(); }
});

test("saving, renaming and deleting presets: each change is the whole set, and it is still there after the core restarts on another port", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-presets-"));
  const preferencesFile = join(dir, "preferences.json");
  try {
    const first = await startCore({ port: 0, preferencesFile });
    cores.push(first);
    assert.equal((await put(first.url, "presets", { Work: state() })).status, 200); // save
    assert.deepEqual(Object.keys(saved(await (await fetch(first.url + "/")).text()).presets), ["Work"]);
    assert.equal((await put(first.url, "presets", { Work: state(), Review: state({ chatFolded: true }) })).status, 200); // save another
    assert.equal((await put(first.url, "presets", { "Work 2": state(), Review: state({ chatFolded: true }) })).status, 200); // rename Work
    first.close();
    const second = await startCore({ port: 0, preferencesFile });
    cores.push(second);
    assert.notEqual(second.url, first.url);
    assert.deepEqual(Object.keys(saved(await (await fetch(second.url + "/")).text()).presets), ["Work 2", "Review"]);
    assert.equal((await put(second.url, "presets", { Review: state({ chatFolded: true }) })).status, 200); // delete Work 2
    assert.deepEqual(Object.keys(saved(await (await fetch(second.url + "/")).text()).presets), ["Review"]);
    assert.equal((await put(second.url, "presets", {})).status, 200); // delete the last one
    second.close();
  } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
});

test("a set of presets that overwrites a built-in, repeats a name, or is not shaped right is refused, and the saved set stays", async () => {
  const core = await startCore({ port: 0 });
  try {
    assert.equal((await put(core.url, "presets", { Work: state() })).status, 200);
    const bad: [string, unknown][] = [
      ["a built-in name", { Default: state() }],
      ["a built-in name in other letters", { " classic ide ": state() }],
      ["Canvas only", { "CANVAS ONLY": state() }],
      ["an empty name", { "  ": state() }],
      ["a name that is too long", { ["x".repeat(41)]: state() }],
      ["a name with a control character", { "bad\u0007name": state() }],
      ["the same name twice in other letters", { Work: state(), work: state() }],
      ["more than 20 presets", Object.fromEntries(Array.from({ length: 21 }, (_, i) => [`p${i}`, state()]))],
      ["a preset that is not an object", { Work: "text" }],
      ["a preset that is a list", { Work: [1] }],
      ["a preset that is far too large", { Work: state({ filler: "x".repeat(200_001) }) }],
      ["a set that is a list", [state()]],
      ["a set that is null", null],
    ];
    for (const [what, body] of bad) assert.ok(refused((await put(core.url, "presets", body)).status), what);
    assert.deepEqual(Object.keys(saved(await (await fetch(core.url + "/")).text()).presets), ["Work"]);
  } finally { core.close(); }
});

test("whether a Layout is remembered for each Project or shared is a choice the core keeps, with a Layout for each Project path", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aidea-presets-"));
  const preferencesFile = join(dir, "preferences.json");
  try {
    const first = await startCore({ port: 0, preferencesFile });
    cores.push(first);
    for (const scope of ["shared", "project"]) assert.equal((await put(first.url, "layoutScope", scope)).status, 200, scope);
    for (const bad of ["both", "", 1, null, ["project"]]) assert.equal((await put(first.url, "layoutScope", bad)).status, 400, JSON.stringify(bad));
    assert.equal((await put(first.url, "projectLayouts", { "C:\\work\\shop": state(), "/home/a/blog": state({ chatFolded: true }) })).status, 200);
    for (const bad of [[state()], "x", null, { "C:\\a": "text" }, { "C:\\a": [1] }, { "C:\\a": state({ filler: "x".repeat(200_001) }) }, Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`/p${i}`, state()]))]) {
      assert.ok(refused((await put(first.url, "projectLayouts", bad)).status), JSON.stringify(bad).slice(0, 40));
    }
    first.close();
    const second = await startCore({ port: 0, preferencesFile });
    cores.push(second);
    const now = saved(await (await fetch(second.url + "/")).text());
    assert.equal(now.layoutScope, "project");
    assert.deepEqual(Object.keys(now.projectLayouts), ["C:\\work\\shop", "/home/a/blog"]);
    second.close();
  } finally { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
});

test("nothing of a preset or of the Layout choice is written inside a Project folder", async () => {
  const project = mkdtempSync(join(tmpdir(), "aidea-presets-project-"));
  cpSync(fixture("shop"), project, { recursive: true });
  const listing = () => readdirSync(project, { recursive: true }).map(String).sort();
  const core = await startCore({ port: 0 });
  try {
    await fetch(core.url + "/projects", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: project }) });
    const before = listing();
    await put(core.url, "presets", { Work: state() });
    await put(core.url, "layoutScope", "project");
    await put(core.url, "projectLayouts", { [project]: state() });
    assert.deepEqual(listing(), before);
  } finally { core.close(); rmSync(project, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); }
});
