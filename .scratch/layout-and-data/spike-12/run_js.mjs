// Throwaway: what a JS value recorder can see. NOT wired to anything: the TS adapter has no run().
// Identity: no id() in JS; a Map/WeakMap keyed by the object itself gives the same job.
import { performance } from "node:perf_hooks";
import { writeFileSync } from "node:fs";

const ids = new WeakMap(); // across snapshots: stable id per object
let next = 0;
const idOf = (o) => { if (!ids.has(o)) ids.set(o, next++); return ids.get(o); };

function capture(v, lim, seen, depth, budget) {
  if (v === null || ["number", "string", "boolean", "undefined", "bigint"].includes(typeof v))
    return { kind: "scalar", type: typeof v, value: typeof v === "bigint" ? String(v) : v === undefined ? "undefined" : v };
  if (typeof v === "symbol") return { kind: "opaque", type: "symbol", text: String(v) };
  if (typeof v === "function") return { kind: "opaque", type: "function", text: `<function ${v.name || "anonymous"}>` };
  const id = idOf(v);
  if (seen.has(v)) return { kind: "ref", id };
  seen.add(v);
  const tag = Object.prototype.toString.call(v).slice(8, -1); // Array, Map, Set, Promise, Date, ...
  if (["Promise", "WeakMap", "WeakSet", "Generator", "AsyncGenerator", "Proxy"].includes(tag)) return { kind: "opaque", type: tag, id, text: `<${tag}>` };
  if (budget.n <= 0 || depth >= lim.depth) return { kind: "cut", id, type: tag };
  budget.n--;
  const sub = (x) => capture(x, lim, seen, depth + 1, budget);
  if (Array.isArray(v)) return { kind: "seq", type: "Array", id, len: v.length, items: v.slice(0, lim.items).map(sub), hidden: Math.max(0, v.length - lim.items) };
  if (v instanceof Set) { const a = [...v]; return { kind: "seq", type: "Set", id, len: a.length, items: a.slice(0, lim.items).map(sub), hidden: Math.max(0, a.length - lim.items) }; }
  if (v instanceof Map) { const a = [...v]; return { kind: "map", type: "Map", id, len: a.length, entries: a.slice(0, lim.items).map(([k, x]) => [sub(k), sub(x)]), hidden: Math.max(0, a.length - lim.items) }; }
  const keys = Object.keys(v); // own enumerable only; getters are NOT called here (Object.keys does not run them)
  return { kind: "object", type: v.constructor?.name ?? "Object", id, fields: Object.fromEntries(keys.slice(0, lim.items).map((k) => [k, sub(v[k])])), hidden: Math.max(0, keys.length - lim.items) };
}
const snap = (locals, lim) => { const seen = new Set(); const b = { n: lim.nodes }; return Object.fromEntries(Object.entries(locals).map(([k, v]) => [k, capture(v, lim, seen, 0, b)])); };

class Node { constructor(v) { this.value = v; this.next = null; } }
const a = new Node(1), b = new Node(2); a.next = b; b.next = a;
const shared = [0];
const locals = { a, x: { p: shared }, y: { q: shared }, fn: () => 1, m: new Map([["k", [1]]]), s: new Set([1]), pr: Promise.resolve(1), sym: Symbol("s"), big: 10n, u: undefined, d: new Date(0), nan: NaN };
const out = snap(locals, { depth: 6, items: 100, nodes: 500 });
writeFileSync(new URL("./shapes_js.json", import.meta.url), JSON.stringify(out, null, 1));
console.log("cycle:", JSON.stringify(out.a.fields.next.fields.next));
console.log("alias:", out.x.fields.p.id, JSON.stringify(out.y.fields.q));
console.log("opaque:", ["fn", "pr", "sym"].map((k) => k + "=" + out[k].kind + ":" + out[k].type).join(" "));
console.log("Date/NaN (JSON would lose these):", JSON.stringify(out.d.kind), JSON.stringify(out.nan));

const LIM = { depth: 6, items: 100, nodes: 500 }, UNL = { depth: 1e9, items: 1e9, nodes: 1e9 };
function time(label, locals, lim) {
  const t0 = performance.now(); const s = snap(locals, lim); const t1 = performance.now();
  console.log(label, { ms: +(t1 - t0).toFixed(2), bytes: JSON.stringify(s).length });
}
const nums = Array.from({ length: 10000 }, (_, i) => i);
let head = new Node(0), cur = head; for (let i = 1; i < 1000; i++) { const n = new Node(i); cur.next = n; cur = n; }
time("list10000  limited  ", { nums }, LIM);
time("list10000  unlimited", { nums }, UNL);
time("linked1000 limited  ", { head }, LIM);
try { time("linked1000 unlimited", { head }, UNL); } catch (e) { console.log("linked1000 unlimited:", e.constructor.name); }
