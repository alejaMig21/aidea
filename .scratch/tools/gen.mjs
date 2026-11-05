import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { items } from "./items.mjs";
process.chdir(new URL("..", import.meta.url).pathname.slice(1));
const by = new Map(items.map((i) => [i.id, i]));
for (const i of items) for (const d of i.d) if (!by.has(d)) throw new Error(`${i.id} depends on unknown ${d}`);
// levels (longest path), cycle check
const level = new Map();
const visiting = new Set();
const lv = (id) => {
  if (level.has(id)) return level.get(id);
  if (visiting.has(id)) throw new Error("cycle at " + id);
  visiting.add(id);
  const l = by.get(id).d.length ? 1 + Math.max(...by.get(id).d.map(lv)) : 0;
  visiting.delete(id);
  level.set(id, l);
  return l;
};
items.forEach((i) => lv(i.id));
// transitive dependents
const rev = new Map(items.map((i) => [i.id, []]));
for (const i of items) for (const d of i.d) rev.get(d).push(i.id);
const memo = new Map();
const deps = (id) => { if (memo.has(id)) return memo.get(id); const s = new Set(); for (const c of rev.get(id)) { s.add(c); for (const x of deps(c)) s.add(x); } memo.set(id, s); return s; };
const unblocks = (id) => deps(id).size;
// every row of the old backlog must still be there
const old = readFileSync("backlog.md", "utf8").split("\n").filter((l) => /^\| [TDI] \|/.test(l));
const wheres = new Set(items.map((i) => i.w));
const lost = old.filter((l) => { const cells = l.split("|").map((c) => c.trim()); const w = cells[3]; return ![...wheres].some((x) => x === w || w.includes(x) || x.includes(w)); });
if (lost.length) console.log("OLD ROWS NOT MATCHED:\n" + lost.map((l) => l.slice(0, 110)).join("\n"));
// order
const maxLevel = Math.max(...level.values());
const sorted = [...items].sort((a, b) => level.get(a.id) - level.get(b.id) || (b.prio ?? 0) - (a.prio ?? 0) || unblocks(b.id) - unblocks(a.id) || a.id.localeCompare(b.id));
const label = (id) => { const x = by.get(id); const named = { cbs: "the Codebase Memory spike", inst_spec: "the Instances spec", inst: "Instances (backlog)", prov: "Roles and Providers (backlog)", anim: "the animation engine (backlog)", dep: "the Deployment layer (backlog)" }; return x.k === "T" ? x.w : named[id] ?? id; };
const sizeNote = { S: "S", M: "M", L: "L", XL: "XL" };
let out = [
  "# The backlog: everything still to do, in the order of development",
  "",
  "This is the one list the work follows (agreed with the person, 2026-11-05). It is ordered by **dependencies**: an item with no dependencies is at the top; an item that depends on others is below all of them. Size is not the criterion. Within a level the order is: the person's priorities first, then the items that unblock the most others. The list is generated from the dependency graph; when it changes, the graph changes first.",
  "",
  "Rules:",
  "1. **When an item is finished, it is deleted from this file** (its ticket and the git history keep the record), and the items that waited for it move up.",
  "2. **When a new idea or decision comes up in a conversation, it is added here in the same turn**, with its dependencies, a size and its marker, and everything it changes (tickets, specs, glossary) is updated in the same turn.",
  "3. Every item has a ticket (marker `T`); a ticket keeps its row until it is done. A new idea gets its ticket in the same turn, with status needs-info if it is only an idea or waits for a spec.",
  "4. The status of a ticket says whether it can start: `ready-for-agent`, or `needs-info` and what it waits for (shown in the Wait column).",
  "5. Every new built-in plugin ships a lesson and a teaching surface (plugin-lessons, plugin-teaching): items that create one depend on those.",
  "",
  `Sizes are the agent's estimate, not measured: S under an hour or two, M one session, L two or three, XL many and a spec first. \`T\` marks an item that has a ticket (all of them). \`wait\` is something outside the work itself: a decision or hardware of the person, or quota for a live check. Last reordered: 2026-11-05 (${items.length} items, ${maxLevel + 1} levels).`,
  "",
].join("\n");
for (let l = 0; l <= maxLevel; l++) {
  const rows = sorted.filter((i) => level.get(i.id) === l);
  out += `## Level ${l}${l === 0 ? ": no dependencies" : `: depends only on levels below (${rows.length} items)`}\n\n| ID | | Size | Work | Where | Depends on | Unblocks | Wait |\n|---|---|---|---|---|---|---|---|\n`;
  for (const i of rows) out += `| ${i.id} | ${i.k} | ${sizeNote[i.s]} | ${i.t} | ${i.w} | ${i.d.join(", ") || "-"} | ${unblocks(i.id) || "-"} | ${i.ext ?? "-"} |\n`;
  out += "\n";
}
out += [
  "## Tickets that are not work any more",
  "",
  "Obsolete: live-findings 04, v1-gaps 11, tutor 10. Folded into other work: aidea-guide 01's live check (plugin-lessons 05).",
  "",
  "## Not read in this pass",
  "",
  "`.scratch/overnight/PLAN.md` and `LOG.md`, and `.scratch/future/research-deployment-notations.md`.",
  "",
].join("\n");
writeFileSync("backlog.md", out);
// blocked-by of the tickets that have a file
let touched = 0;
for (const i of items) {
  if (!i.file) continue;
  const [folder, num] = i.file.split("/");
  const dir = `${folder}/issues/`;
  const name = readdirSync(dir).find((n) => n.startsWith(num + "-"));
  if (!name) throw new Error("no ticket file for " + i.file);
  const p = dir + name;
  let t = readFileSync(p, "utf8");
  const line = i.d.length ? `**Blocked by:** ${i.d.map(label).join(", ")}.` : "**Blocked by:** None (can start immediately).";
  if (!/^\*\*Blocked by:\*\*.*$/m.test(t)) throw new Error("no blocked-by in " + p);
  t = t.replace(/^\*\*Blocked by:\*\*.*$/m, line);
  writeFileSync(p, t);
  touched++;
}
console.log("levels", maxLevel + 1, "items", items.length, "tickets touched", touched);
for (let l = 0; l <= maxLevel; l++) console.log(l, sorted.filter((i) => level.get(i.id) === l).map((i) => i.id).join(" "));
