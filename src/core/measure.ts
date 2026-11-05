// The measurement (tutor-rewrite 02): the Tutor finds out what the person already understands INSIDE the conversation, as LearnHarness does, instead of in a separate run.
// For each prerequisite topic it chooses, it finds the floor (the hardest thing the person reliably gets right) and the ceiling (the easiest thing they get wrong or do not know).
// The core enforces what the model cannot be trusted with: twelve questions at most, no question about an idea the Learner graph already holds, one hand-over, and a skip that
// always works. Results live in the per-user folder, outside any Project.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalise } from "./learner-pipeline.ts";
import type { Core } from "./types.ts";

export const MAX_MEASURE_QUESTIONS = 12;

// What each layer needs the person to understand. Still read by the layer classes and the Plan; it goes with them (tutor-rewrite 08).
export const LAYER_CONCEPTS: Record<string, string[]> = {
  business: ["customer segment", "value proposition", "channels"],
  requirements: ["functional vs non-functional requirement", "acceptance criteria"],
  architecture: ["container", "relationship", "boundary"],
  components: ["module", "class", "dependency"],
  flow: ["decision", "loop", "trace"],
  data: ["variable", "list and position", "dictionary"],
};
export const isLayer = (x: unknown): x is string => typeof x === "string" && Object.hasOwn(LAYER_CONCEPTS, x);

// A layer id that was renamed: Plans stored under the old id are read back under the new one.
const RENAMED_LAYERS: Record<string, string> = { algorithms: "flow" };
export const currentLayer = (layer: unknown) => (typeof layer === "string" ? RENAMED_LAYERS[layer] ?? layer : layer);

export type Bracket = { name: string; floor: string | null; ceiling: string | null; note: string };
export type MeasureResult = { project: string; topics: Bracket[]; questions: number; time: string };

// The state of the measurement in one session.
export const createMeasureState = () => ({ asked: 0, topics: new Set<string>(), done: false });

// The stored results (measures.jsonl: one line per result, the last for a Project wins; memory only without a folder).
export function createMeasures(dir?: string) {
  const file = dir && join(dir, "measures.jsonl");
  const results = new Map<string, MeasureResult>();
  if (file && existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      try {
        const r = JSON.parse(line);
        if (r?.project && Array.isArray(r.topics)) results.set(r.project, r);
      } catch {
        // an empty or torn line: skipped
      }
    }
  }
  return {
    get: (project: string) => results.get(project),
    put(r: MeasureResult) {
      if (file) {
        mkdirSync(dir!, { recursive: true });
        appendFileSync(file, "\n" + JSON.stringify(r) + "\n"); // a leading newline: a torn last line cannot swallow this record
      }
      results.set(r.project, r);
    },
  };
}
export type Measures = ReturnType<typeof createMeasures>;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const FIELDS = ["name", "floor", "ceiling", "note"];

// Checks what the Tutor handed over. The error text is written for the model: it says what to change.
export function parseBrackets(raw: unknown): { topics: Bracket[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) return { error: "measure_done needs topics: a list of 1 to 20 entries {name, floor, ceiling, note}, one per topic you looked at" };
  const topics: Bracket[] = [];
  const seen = new Set<string>();
  for (const [i, t] of raw.entries()) {
    const at = `topics[${i}]`;
    if (!isObj(t)) return { error: `${at} must be an object {name, floor, ceiling, note}` };
    const extra = Object.keys(t).find((k) => !FIELDS.includes(k));
    if (extra) return { error: `${at} has an unknown field "${extra}": use only name, floor, ceiling and note` };
    if (typeof t.name !== "string" || !t.name.trim() || t.name.length > 200) return { error: `${at}.name must be the topic's name, as text of at most 200 characters` };
    const key = normalise(t.name);
    if (seen.has(key)) return { error: `${at}.name lists "${t.name.trim()}" twice: one entry per topic` };
    seen.add(key);
    for (const side of ["floor", "ceiling"] as const) {
      const v = t[side];
      if (v !== null && (typeof v !== "string" || !v.trim() || v.length > 300)) return { error: `${at}.${side} must be one sentence of at most 300 characters, or null when there is none (floor: the hardest thing they reliably got right; ceiling: the easiest thing they got wrong or did not know)` };
    }
    if (typeof t.note !== "string" || t.note.length > 500) return { error: `${at}.note must be text of at most 500 characters: one sentence on where their understanding ends` };
    topics.push({ name: t.name.trim(), floor: t.floor === null ? null : (t.floor as string).trim(), ceiling: t.ceiling === null ? null : (t.ceiling as string).trim(), note: t.note.trim() });
  }
  return { topics };
}

// The idea on the Learner graph that a name (normalised) stands for, under its name or an alias. This is what "held" means for the measurement.
export const heldIdea = (core: Core, idea: string) => core.learner.graph().propositions.find((p) => [p.name, ...p.aliases].some((n) => normalise(n) === idea));

// A class goes further than the measurement: the graph holds what the Teacher taught, so an idea also needs strong Evidence in this Project before the Teacher is told to skip it:
// a correct answer about it, given with confidence 70 or more (when a confidence was asked), in the last 90 days.
// Only an answer to a check or an ask counts: a prediction, a review answer and a run-prediction are never strong Evidence.
// A missing confidence means none was asked (a written answer graded by the grader), so it counts as sure enough.
const STRONG_CONFIDENCE = 70;
const STRONG_DAYS = 90;
const NOT_A_CHECK = ["predict", "review"];
// ponytail: reads the whole Evidence list per idea, so `held_ideas` is O(propositions x evidence); compute the list once per call if the ledger grows large.
export function heldStrongly(core: Core, project: string, idea: string) {
  const held = heldIdea(core, idea);
  if (!held) return undefined;
  const names = new Set([held.name, ...held.aliases].map(normalise));
  const since = new Date(Date.now() - STRONG_DAYS * 86_400_000).toISOString();
  const strong = core.learner
    .evidence({ project })
    .some((e) => e.correct === true && e.kind !== "run-prediction" && !NOT_A_CHECK.includes(e.phase ?? "") && (e.confidence ?? 100) >= STRONG_CONFIDENCE && e.time >= since && names.has(e.idea ?? e.item ?? ""));
  return strong ? held : undefined;
}
