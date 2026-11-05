// Usage: node closeitem.mjs <id> [<id> ...]: removes finished items from the backlog data, regenerates backlog.md, and checks nothing still depends on them wrongly.
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { items } from "./items.mjs";
const ids = process.argv.slice(2);
if (!ids.length) throw new Error("no ids");
for (const id of ids) if (!items.some((i) => i.id === id)) throw new Error("unknown id " + id);
const out = items.filter((i) => !ids.includes(i.id));
for (const i of out) i.d = i.d.filter((d) => !ids.includes(d));
writeFileSync(new URL("./items.mjs", import.meta.url), `// The backlog as data: id, k (T ticket), s (size), t (work), w (where), d (dependencies), ext (wait), file (folder/NN of its ticket), prio.\nexport const items = ${JSON.stringify(out, null, 1)};\n`);
console.log("removed", ids.join(", "), "left", out.length);
execFileSync("node", [new URL("./gen.mjs", import.meta.url).pathname.slice(1)], { stdio: "inherit" });
