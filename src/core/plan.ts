// The Plan: the concepts the person must understand for a Project, in dependency order, and the decisions still open on each layer.
// The Teacher sets it with set_plan and revises it the same way (each call replaces the last); the person never edits it by hand.
// The core refuses a cycle and, once a Plan exists, any step about an item outside it. What is "covered" is never stored:
// it is derived from the Evidence and the Learner graph every time it is asked for. Plans live in the per-user folder, outside any Project.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalise } from "./learner-pipeline.ts";
import { LAYER_CONCEPTS, currentLayer, isLayer } from "./measure.ts";
import type { Core } from "./types.ts";

export type PlanConcept = { id: string; name: string; dependsOn: string[]; layer?: string };
export type PlanDecision = { layer: string; question: string };
// `approved`: the person said "Go ahead" to exactly this Plan (tutor-rewrite 03). A different Plan starts without it.
export type Plan = { project: string; concepts: PlanConcept[]; decisions: PlanDecision[]; time: string; approved?: true };
export type PlanChanges = { added: string[]; removed: string[]; kept: string[] };

const str = { type: "string" };
export const PLAN_TOOLS = [
  {
    name: "get_plan",
    description: "Returns the Plan stored for this Project (null if none) and the stored measurement (per topic: floor, ceiling, note; null if you have not measured yet), so you can build or revise the Plan from what the person already knows.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "plan_ahead",
    description:
      "Shows the person the Plan with your explanation (a few sentences: what you will teach, in what order, and why) and waits for their answer: \"Go ahead\" or \"Change the Plan first\" (with their words). Call it after set_plan. No step begins before they say go ahead; if they want a change, revise the Plan with set_plan, say what changed, and ask again.",
    inputSchema: { type: "object", properties: { summary: str }, required: ["summary"] },
  },
  {
    name: "set_plan",
    description:
      "Sets the Plan for this Project, replacing the previous one (to revise it, send the whole new Plan, keeping the items that still hold). " +
      "concepts: 1 to 30 of {name, dependsOn: [names of other concepts it needs first], layer?: one of the five layers}. decisions: {layer, question} for the choices still open. " +
      "Dependencies must not form a cycle. Items are never marked done: what the person has covered is worked out by aidea.",
    inputSchema: {
      type: "object",
      properties: {
        concepts: { type: "array", items: { type: "object", properties: { name: str, dependsOn: { type: "array", items: str }, layer: str }, required: ["name", "dependsOn"] } },
        decisions: { type: "array", items: { type: "object", properties: { layer: str, question: str }, required: ["layer", "question"] } },
      },
      required: ["concepts"],
    },
  },
];

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const LAYERS_TEXT = Object.keys(LAYER_CONCEPTS).join(", ");
const text = (x: unknown, max: number): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= max;
const onlyKeys = (o: Record<string, unknown>, keys: string[], at: string) => {
  const extra = Object.keys(o).find((k) => !keys.includes(k));
  return extra ? `${at} has an unknown field "${extra}": use only ${keys.join(", ")}. Items are never marked done; aidea works that out.` : undefined;
};

// Checks what the Teacher sent. The error text is written for the model: it says what to change.
export function parsePlan(args: Record<string, unknown>): { concepts: Omit<PlanConcept, "id">[]; decisions: PlanDecision[] } | { error: string } {
  const { concepts: raw, decisions: rawDecisions = [] } = args;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 30) return { error: "set_plan needs concepts: a list of 1 to 30 entries {name, dependsOn, layer?}" };
  const concepts: Omit<PlanConcept, "id">[] = [];
  const seen = new Set<string>();
  for (const [i, c] of raw.entries()) {
    const at = `concepts[${i}]`;
    if (!isObj(c)) return { error: `${at} must be an object {name, dependsOn, layer?}` };
    const extra = onlyKeys(c, ["name", "dependsOn", "layer"], at);
    if (extra) return { error: extra };
    if (!text(c.name, 200)) return { error: `${at}.name must be the concept's name, as text of at most 200 characters` };
    const key = normalise(c.name);
    if (seen.has(key)) return { error: `${at}.name "${c.name}" is listed twice. Each concept appears once.` };
    seen.add(key);
    if (!Array.isArray(c.dependsOn) || !c.dependsOn.every((d) => text(d, 200))) return { error: `${at}.dependsOn must be a list (possibly empty) of the names of concepts it needs first` };
    if (c.layer !== undefined && !isLayer(c.layer)) return { error: `${at}.layer must be one of ${LAYERS_TEXT}` };
    concepts.push({ name: c.name.trim(), dependsOn: c.dependsOn.map((d: string) => d.trim()), ...(c.layer ? { layer: c.layer as string } : {}) });
  }
  for (const [i, c] of concepts.entries()) {
    const missing = c.dependsOn.find((d) => !seen.has(normalise(d)));
    if (missing) return { error: `concepts[${i}] ("${c.name}") depends on "${missing}", which is not a concept of the Plan. Add it as a concept or remove the dependency.` };
  }
  const cycle = findCycle(concepts);
  if (cycle) return { error: `The dependencies form a cycle: ${cycle.join(" -> ")}. Break it so every concept can be taught after the ones it needs.` };
  if (!Array.isArray(rawDecisions) || rawDecisions.length > 30) return { error: "decisions must be a list of at most 30 entries {layer, question}" };
  const decisions: PlanDecision[] = [];
  for (const [i, d] of rawDecisions.entries()) {
    const at = `decisions[${i}]`;
    if (!isObj(d)) return { error: `${at} must be an object {layer, question}` };
    const extra = onlyKeys(d, ["layer", "question"], at);
    if (extra) return { error: extra };
    if (!isLayer(d.layer)) return { error: `${at}.layer must be one of ${LAYERS_TEXT}` };
    if (!text(d.question, 300)) return { error: `${at}.question must be the open decision, as text of at most 300 characters` };
    decisions.push({ layer: d.layer, question: d.question.trim() });
  }
  return { concepts, decisions };
}

// The first dependency cycle, as a closed path of names, or null.
function findCycle(concepts: { name: string; dependsOn: string[] }[]): string[] | null {
  const byKey = new Map(concepts.map((c) => [normalise(c.name), c]));
  const state = new Map<string, 1 | 2>(); // 1 on the current path, 2 finished
  const path: string[] = [];
  const visit = (c: { name: string; dependsOn: string[] }): string[] | null => {
    const k = normalise(c.name);
    if (state.get(k) === 2) return null;
    if (state.get(k) === 1) return [...path.slice(path.findIndex((n) => normalise(n) === k)), c.name];
    state.set(k, 1);
    path.push(c.name);
    for (const d of c.dependsOn) {
      const found = visit(byKey.get(normalise(d))!);
      if (found) return found;
    }
    path.pop();
    state.set(k, 2);
    return null;
  };
  for (const c of concepts) {
    const found = visit(c);
    if (found) return found;
  }
  return null;
}

// plans.jsonl: one line per set_plan, the last for a Project wins (memory only without a folder).
export function createPlans(dir?: string) {
  const file = dir && join(dir, "plans.jsonl");
  const plans = new Map<string, Plan>();
  if (file && existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      try {
        const p = JSON.parse(line);
        if (p?.project && Array.isArray(p.concepts)) {
          for (const x of [...p.concepts, ...(p.decisions ?? [])]) if (x.layer) x.layer = currentLayer(x.layer);
          p.concepts.forEach((c: PlanConcept, i: number) => { c.id ??= `c${i + 1}`; }); // a Plan stored before ids existed
          plans.set(p.project, p);
        }
      } catch {
        // an empty or torn line: skipped
      }
    }
  }
  return {
    get: (project: string) => plans.get(project),
    // The person said "Go ahead" to the Plan as it is.
    approve(project: string) {
      const p = plans.get(project);
      if (p && !p.approved) this.put({ ...p, approved: true });
    },
    put(p: Plan) {
      if (file) {
        mkdirSync(dir!, { recursive: true });
        appendFileSync(file, "\n" + JSON.stringify(p) + "\n"); // a leading newline: a torn last line cannot swallow this record
      }
      plans.set(p.project, p);
    },
  };
}
export type Plans = ReturnType<typeof createPlans>;

// The concepts of a revised Plan keep the id of the item of the same name; a new item gets a fresh one.
function withIds(concepts: Omit<PlanConcept, "id">[], previous?: Plan): PlanConcept[] {
  const old = new Map((previous?.concepts ?? []).map((c) => [normalise(c.name), c.id]));
  let next = Math.max(0, ...(previous?.concepts ?? []).map((c) => Number(/^c(\d+)$/.exec(c.id)?.[1] ?? 0))) + 1;
  return concepts.map((c) => ({ id: old.get(normalise(c.name)) ?? `c${next++}`, ...c }));
}
const shapeOf = (p: Plan) => JSON.stringify(p.concepts.map((c) => [normalise(c.name), c.dependsOn.map(normalise).sort()]).sort());
const changesOf = (previous: Plan | undefined, now: PlanConcept[]): PlanChanges => {
  const before = new Set((previous?.concepts ?? []).map((c) => normalise(c.name))), after = new Set(now.map((c) => normalise(c.name)));
  return {
    added: now.filter((c) => !before.has(normalise(c.name))).map((c) => c.name),
    removed: (previous?.concepts ?? []).filter((c) => !after.has(normalise(c.name))).map((c) => c.name),
    kept: now.filter((c) => before.has(normalise(c.name))).map((c) => c.name),
  };
};

// The names of the Plan's concepts the person has covered: the idea is on the Learner graph, or a check about it was answered correctly.
export function coveredOf(core: Core, plan: Plan): string[] {
  const held = new Set(core.learner.graph().propositions.flatMap((p) => [p.name, ...p.aliases].map(normalise)));
  const checked = new Set(core.learner.evidence({ project: plan.project }).filter((e) => e.phase === "check" && e.correct === true && e.item).map((e) => e.item));
  return plan.concepts.map((c) => c.name).filter((n) => held.has(normalise(n)) || checked.has(normalise(n)));
}

// The item a step is about, checked against the Plan. Without a Plan any step is allowed (the Plan never gates a first class).
export function itemFor(core: Core, project: string, item: unknown): { item?: string } | { error: string } {
  const plan = core.plans.get(project);
  if (!plan) return {};
  const names = plan.concepts.map((c) => c.name);
  if (typeof item !== "string" || !item.trim()) return { error: `begin_step needs \`item\`: the Plan concept this step is about. The Plan holds: ${names.join(", ")}. If the person needs something else, change the Plan with set_plan first.` };
  const hit = plan.concepts.find((c) => normalise(c.name) === normalise(item));
  if (!hit) return { error: `"${item.trim()}" is not in the Plan, so the person is not asked about it. The Plan holds: ${names.join(", ")}. Pick one of those, or change the Plan with set_plan if the person asked for it.` };
  return { item: normalise(hit.name) };
}

type Reply = { text: string; isError?: true };
// Runs get_plan and set_plan for a class. Null when the tool is not one of them.
export function runPlanTool(name: string, args: Record<string, unknown>, core: Core, project: string, emit: (e: object) => void): Reply | null {
  if (name === "get_plan") {
    return { text: JSON.stringify({ plan: core.plans.get(project) ?? null, measure: core.measures.get(project) ?? null }) };
  }
  if (name !== "set_plan") return null;
  const parsed = parsePlan(args);
  if ("error" in parsed) return { text: parsed.error, isError: true };
  const previous = core.plans.get(project);
  const plan: Plan = { project, concepts: withIds(parsed.concepts, previous), decisions: parsed.decisions, time: new Date().toISOString() };
  if (previous?.approved && shapeOf(previous) === shapeOf(plan)) plan.approved = true; // the same Plan sent again keeps the go-ahead
  const changes = changesOf(previous, plan.concepts);
  core.plans.put(plan);
  emit({ type: "tutor_plan", plan, covered: coveredOf(core, plan), changes });
  const next = plan.approved
    ? "The Plan is as the person approved it. Begin a step with begin_step, giving `item`: one of the Plan's concepts."
    : "The Plan is set and shown to the person. Explain it in a few sentences and ask with plan_ahead: no step begins before they say go ahead.";
  return { text: JSON.stringify({ ok: true, plan, changes, next }) };
}
