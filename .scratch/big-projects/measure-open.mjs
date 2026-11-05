// Times opening a real project and drawing its Components layer through the core's own protocol.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.chdir("D:/Projects/aidea");
const { startCore } = await import("file:///D:/Projects/aidea/src/core/server.ts");
const scratch = mkdtempSync(join(tmpdir(), "aidea-perf-"));
const core = await startCore({ port: 0, recentsFile: join(scratch, "r.json"), preferencesFile: join(scratch, "p.json"), learnerDir: join(scratch, "l"), pluginsDir: join(scratch, "s") });
const project = process.argv[2] ?? "D:/Projects/Telegram";
const t = async (label, fn) => { const t0 = performance.now(); const r = await fn(); console.log(`${label}: ${Math.round(performance.now() - t0)} ms`); return r; };
const post = (p, b) => fetch(core.url + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) });
const opened = await t("open project (POST /projects)", async () => { const r = await post("/projects", { path: project }); return { status: r.status, body: await r.json().catch(() => null) }; });
console.log("open ->", opened.status, JSON.stringify(opened.body)?.slice(0, 300));
const q = `project=${encodeURIComponent(project)}`;
for (const [label, path] of [["layout components", `/layout?${q}&layer=components`], ["layout components again", `/layout?${q}&layer=components`]]) {
  const body = await t(label, async () => { const r = await fetch(core.url + path); const text = await r.text(); return { status: r.status, size: text.length, json: JSON.parse(text) }; });
  const j = body.json;
  console.log(" status", body.status, "bytes", body.size, "keys", Object.keys(j).join(","));
  console.log(" mode", j.mode, "rects", j.rects?.length, "routes", j.routes?.length, "pairs", JSON.stringify(j.pairs), "note", JSON.stringify(j.note)?.slice(0, 200));
}
const ov = await (await fetch(core.url + `/layout?${q}&layer=components`)).json();
const kinds = {};
for (const r of ov.rects ?? []) kinds[r.kind ?? r.type ?? "?"] = (kinds[r.kind ?? r.type ?? "?"] ?? 0) + 1;
console.log("rect kinds", JSON.stringify(kinds));
core.close();
process.exit(0);
