// The end-of-class pipeline: an Extractor proposes ideas and chains from the Teacher's prose, an Auditor proposes which names
// are the same idea, and mergeGraph, which uses no model, is the only thing that writes. The person's answers never come here.
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter } from "./types.ts";
import { createLearnerStore } from "./learner.ts";
import type { Chain, Graph, PendingClass, Proposition, Provenance } from "./learner.ts";

export const normalise = (name: string) => name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
export const idOf = (name: string) => normalise(name).replaceAll(" ", "-");
const chainId = (premises: string[], conclusion: string) => "ch-" + createHash("sha1").update([...premises].sort().join("\n") + "\n=>" + conclusion).digest("hex").slice(0, 12);

export type Extracted = {
  propositions: { name: string; statement: string; aliases?: string[]; message: number }[];
  chains: { premises: string[]; conclusion: string; message: number }[];
};

const str = { type: "string" };
export const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    propositions: { type: "array", items: { type: "object", properties: { name: str, statement: str, aliases: { type: "array", items: str }, message: { type: "integer" } }, required: ["name", "statement", "message"] } },
    chains: { type: "array", items: { type: "object", properties: { premises: { type: "array", items: str }, conclusion: str, message: { type: "integer" } }, required: ["premises", "conclusion", "message"] } },
  },
  required: ["propositions", "chains"],
};
export const AUDIT_SCHEMA = {
  type: "object",
  properties: { links: { type: "array", items: { type: "object", properties: { names: { type: "array", items: str } }, required: ["names"] } } },
  required: ["links"],
};
const EXTRACT_INSTRUCTIONS =
  "Read numbered messages from a teacher. List the separate ideas (propositions) they state as claims: a name, one self-contained statement, optional other names, and the number of the message that states it. " +
  "A name is a short phrase in plain words, at most six words, like 'a list keeps repeated items': no underscores, no code, no punctuation. An idea is one fact that could be asked about on its own. " +
  "If the same fact is said several times or in several ways, list it once. A class of a few steps has a handful of ideas, not twenty: skip small details. " +
  "List reasoning chains: premises (by name) that lead to a conclusion (by name), with the message number. Use only names you listed. Skip examples, greetings and questions. Answer with the JSON only.";
const AUDIT_INSTRUCTIONS =
  "You get a list of idea names with statements. Report groups of names that state the same fact, even in different words (synonyms, abbreviations, rewordings, one saying a bit more than another). Merge when a question about one would be answered by the other. Never group related but different facts. Use the names exactly as given. Answer with the JSON only.";

const plain = (name: string) => name.replace(/\s*[_`(){}[\]<>=;:.]+\s*/g, " ").trim();
const isObj =(x: unknown): x is Record<string, any> => typeof x === "object" && x !== null && !Array.isArray(x);
const text = (x: unknown, max: number): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= max;
const index = (x: unknown, count: number) => Number.isInteger(x) && (x as number) >= 0 && (x as number) < count;

// Rejects the whole output on the first record that does not match the schema.
export function validateExtracted(x: unknown, messages: number): Extracted {
  const bad = (why: string): never => {
    throw new Error(`invalid Extractor output: ${why}`);
  };
  if (!isObj(x) || !Array.isArray(x.propositions) || !Array.isArray(x.chains)) return bad("propositions and chains are required");
  for (const p of x.propositions) {
    if (!isObj(p) || !text(p.name, 200) || !normalise(p.name) || !text(p.statement, 1000) || !index(p.message, messages)) return bad("a proposition needs a name, a statement and a message number");
    if (p.aliases !== undefined && !(Array.isArray(p.aliases) && p.aliases.every((a: unknown) => text(a, 200) && normalise(a as string)))) return bad("aliases must be names");
  }
  for (const c of x.chains) {
    if (!isObj(c) || !Array.isArray(c.premises) || !c.premises.length || !c.premises.every((p: unknown) => text(p, 200)) || !text(c.conclusion, 200) || !index(c.message, messages)) return bad("a chain needs premises, a conclusion and a message number");
  }
  // Code-looking names become plain words; chains look names up by normalise(), which already ignores these characters.
  for (const p of x.propositions) {
    p.name = plain(p.name);
    if (p.aliases) p.aliases = p.aliases.map(plain);
  }
  return x as Extracted;
}

export function validateLinks(x: unknown): string[][] {
  if (!isObj(x) || !Array.isArray(x.links) || !x.links.every((l: unknown) => isObj(l) && Array.isArray(l.names) && l.names.every((n: unknown) => typeof n === "string"))) {
    throw new Error("invalid Auditor output: links must be a list of {names}");
  }
  return x.links.map((l: any) => l.names);
}

type Item = { names: string[]; statement: string; provenance: Provenance[]; id?: string };

// The only writer of the graph, and a pure function: the same graph and input give the same result.
// `links` are groups of names the Auditor says are one idea. The canonical name is the first seen (ideas already in the
// graph first, then this class by message, shorter name first), never the Auditor's choice.
export function mergeGraph(current: Graph, input: { classId: string; node?: string; project?: string } & Extracted, links: string[][]): Graph {
  const prov = (message: number): Provenance => ({ classId: input.classId, message, ...(input.node ? { node: input.node } : {}), ...(input.project ? { project: input.project } : {}) });
  const items: Item[] = current.propositions.map((p) => ({ names: [p.name, ...p.aliases], statement: p.statement, provenance: p.provenance, id: p.id }));
  const fresh = input.propositions.map((p) => ({ names: [p.name, ...(p.aliases ?? [])], statement: p.statement, provenance: [prov(p.message)] }));
  fresh.sort((a, b) => a.provenance[0].message - b.provenance[0].message || a.names[0].length - b.names[0].length);
  items.push(...fresh);

  // Union-find over items: a shared normalised name, or an Auditor link, puts items in one group.
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const union = (a: number, b: number) => void (parent[Math.max(find(a), find(b))] = Math.min(find(a), find(b)));
  const owner = new Map<string, number>();
  const claim = (key: string, i: number) => (owner.has(key) ? union(owner.get(key)!, i) : owner.set(key, i));
  items.forEach((item, i) => item.names.forEach((n) => claim(normalise(n), i)));
  for (const group of links) {
    const known = group.map((n) => owner.get(normalise(n))).filter((i): i is number => i !== undefined);
    known.slice(1).forEach((i) => union(known[0], i));
  }

  const groups = new Map<number, Item[]>();
  items.forEach((item, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), item]));
  const idOfItem = new Map<Item, string>();
  const propositions: Proposition[] = [...groups.values()].map((members) => {
    const name = members[0].names[0];
    const id = idOf(name);
    members.forEach((m) => idOfItem.set(m, id));
    const seen = new Set<string>();
    const provenance = members.flatMap((m) => m.provenance).filter((p) => !seen.has(`${p.classId}#${p.message}`) && seen.add(`${p.classId}#${p.message}`));
    const aliases = [...new Set(members.flatMap((m) => m.names).filter((n) => n !== name))];
    return { id, name, statement: members[0].statement, aliases, provenance };
  });

  // Chains by id: ones already in the graph are re-pointed at the merged ideas; new ones need every name to exist.
  const remap = new Map(items.flatMap((m) => (m.id ? [[m.id, idOfItem.get(m)!] as const] : [])));
  const byName = (n: string) => (owner.has(normalise(n)) ? idOfItem.get(items[owner.get(normalise(n))!]) : undefined);
  const chains = new Map<string, Chain>();
  const add = (premises: (string | undefined)[], conclusion: string | undefined, provenance: Provenance[]) => {
    if (conclusion === undefined || premises.some((p) => p === undefined)) return; // dangling: dropped
    const ps = [...new Set(premises as string[])];
    if (ps.includes(conclusion)) return; // a chain that concludes one of its premises says nothing
    const id = chainId(ps, conclusion);
    const old = chains.get(id);
    const seen = new Set((old?.provenance ?? []).map((p) => `${p.classId}#${p.message}`));
    chains.set(id, { id, premises: ps, conclusion, provenance: [...(old?.provenance ?? []), ...provenance.filter((p) => !seen.has(`${p.classId}#${p.message}`))] });
  };
  for (const c of current.chains) add(c.premises.map((p) => remap.get(p)), remap.get(c.conclusion), c.provenance);
  for (const c of input.chains) add(c.premises.map(byName), byName(c.conclusion), [prov(c.message)]);
  return { propositions, chains: [...chains.values()] };
}

export async function callRole(adapter: Adapter, role: "extractor" | "auditor" | "grader" | "definer", instructions: string, message: string, schema: object, model: string): Promise<unknown> {
  const cwd = join(tmpdir(), "aidea-learner");
  mkdirSync(cwd, { recursive: true });
  let structured: unknown;
  for await (const event of adapter.run({ role, cwd, message, instructions, schema, model })) {
    if (event.type === "error") throw new Error(`the ${role} failed: ${event.message}`);
    if (event.type === "result") structured = event.structured;
  }
  if (structured === undefined) throw new Error(`the ${role} returned no structured output`);
  return structured;
}

export type ClassOutcome = { status: "saved"; ideas: number } | { status: "failed"; message: string };

// The pipeline and the store behind one object. `model` is the Extractor's and Auditor's model.
export function createLearner(dir: string | undefined, adapter: Adapter, model = "haiku") {
  const store = createLearnerStore(dir);
  const running = new Set<string>();

  async function run(p: PendingClass): Promise<ClassOutcome> {
    try {
      const numbered = p.texts.map((t, i) => `[${i}]\n${t}`).join("\n\n");
      const extracted = validateExtracted(await callRole(adapter, "extractor", EXTRACT_INSTRUCTIONS, numbered, EXTRACT_SCHEMA, model), p.texts.length);
      const current = store.graph();
      const names = [...current.propositions.map((x) => `${x.name}: ${x.statement}`), ...extracted.propositions.map((x) => `${x.name}: ${x.statement}`)];
      const links = names.length < 2 ? [] : validateLinks(await callRole(adapter, "auditor", AUDIT_INSTRUCTIONS, names.map((n) => `- ${n}`).join("\n"), AUDIT_SCHEMA, model));
      const next = mergeGraph(current, { classId: p.classId, node: p.node, project: p.project, ...extracted }, links);
      store.commit(next);
      store.dropPending(p.classId);
      return { status: "saved", ideas: next.propositions.filter((x) => x.provenance.some((v) => v.classId === p.classId)).length };
    } catch (e) {
      return { status: "failed", message: `pipeline failed: ${e instanceof Error ? e.message : String(e)}` };
    }
  }

  return {
    ...store,
    model,
    recordEvidence: store.addEvidence,
    // Keeps the class's prose so a failure can be retried (also after a restart), then runs the pipeline.
    async closeClass(p: PendingClass): Promise<ClassOutcome> {
      if (!p.texts.length) return { status: "saved", ideas: 0 };
      store.savePending(p);
      return this.retry(p.classId) as Promise<ClassOutcome>;
    },
    // "unknown" when the class has nothing waiting (never existed or already closed); "busy" while its pipeline runs.
    async retry(classId: string): Promise<ClassOutcome | "unknown" | "busy"> {
      const p = store.pending(classId);
      if (!p) return "unknown";
      if (running.has(classId)) return "busy";
      running.add(classId);
      try {
        return await run(p);
      } finally {
        running.delete(classId);
      }
    },
  };
}

export type Learner = ReturnType<typeof createLearner>;
