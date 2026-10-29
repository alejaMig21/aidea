// The Probe: a short session of the Prober that measures what the person already understands before the first class of a layer.
// The core enforces the rules the model cannot be trusted with: five questions at most, no question about an idea the Learner graph
// already holds, a strict hand-over (probe_done), and a skip that always works. Results live in the per-user folder, outside any Project.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { evidenceOf } from "./learner.ts";
import type { Evidence } from "./learner.ts";
import { normalise } from "./learner-pipeline.ts";
import { parseQuestion } from "./tutor.ts";
import { READ_TOOLS, runReadTool } from "./tutor-reads.ts";
import type { Core } from "./types.ts";

export const MAX_PROBE_QUESTIONS = 5;

// What each layer needs the person to understand. Given to the Prober as data; other tickets (the Plan) reuse it.
export const LAYER_CONCEPTS: Record<string, string[]> = {
  business: ["customer segment", "value proposition", "channels"],
  requirements: ["functional vs non-functional requirement", "acceptance criteria"],
  architecture: ["container", "relationship", "boundary"],
  components: ["module", "class", "dependency"],
  algorithms: ["decision", "loop", "trace"],
};
export const isLayer = (x: unknown): x is string => typeof x === "string" && Object.hasOwn(LAYER_CONCEPTS, x);

export const PROBE_INSTRUCTIONS = [
  "You are the Prober of aidea, a tool where a person designs software and learns why each decision was made. You run a short check, before a class, of what the person already understands about one layer of their project.",
  "Your first message names the layer and lists the concepts it needs, as data. Work only from that list.",
  `Ask at most ${MAX_PROBE_QUESTIONS} questions, one per concept, with the ask tool. Every question names the concept it measures in \`idea\` (a short name, for example "container"). The tools refuse more than ${MAX_PROBE_QUESTIONS} questions and refuse a concept the person has already shown they understand.`,
  "Call known_ideas first: it returns the names of ideas already on the person's map. Do not ask about those; count them as known.",
  "ask {idea, kind, prompt, ...}: kind \"choice\" needs 2 to 6 options and `correct`, the exact text of the right one, fixed before the question is shown; kind \"text\" is an open question. Ask about using the concept, in plain words. Never teach: this is a measurement, not a class.",
  "The result of ask tells you what the person did. If it says skipped, they told you they already know it: treat it as known and move on. If they did not know, that is useful: record it as unknown.",
  "You may look at the person's own project with the read tools when it makes a question concrete. You cannot write files or run commands.",
  "When you have enough, or after the last question, call probe_done {topics: [{name, status, note}]} exactly once: one entry per concept you looked at, status \"known\", \"partial\" or \"unknown\", and a note of one plain sentence on where their understanding ends. Then end your turn with one short sentence.",
  "If a tool returns an error, read it, fix the call and continue. If it says the person did not answer or skipped the Probe, do not ask again: end your turn.",
].join("\n");

const str = { type: "string" };
export const PROBE_TOOLS = [
  {
    name: "ask",
    description:
      `Asks the person one probe question and waits for the answer. \`idea\` is the short name of the concept it measures (required). kind "choice": give \`prompt\`, \`options\` (2 to 6 texts) and \`correct\` (the exact text of the right option); ` +
      `the person picks one and says how sure they are. kind "text": give \`prompt\`; the person writes in their own words. At most ${MAX_PROBE_QUESTIONS} questions per Probe. The person may answer "I already know this".`,
    inputSchema: {
      type: "object",
      properties: { idea: str, kind: { type: "string", enum: ["choice", "text"] }, prompt: str, options: { type: "array", items: str }, correct: str, allowDontKnow: { type: "boolean" } },
      required: ["idea", "kind", "prompt"],
    },
  },
  {
    name: "known_ideas",
    description: "Returns the names of the ideas already on the person's Learner graph (names only). Do not ask about those.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "probe_done",
    description: "Hands over the result and ends the Probe. Call it once. topics: one {name, status, note} per concept you looked at; status is known, partial or unknown; note is one sentence on where their understanding ends.",
    inputSchema: {
      type: "object",
      properties: { topics: { type: "array", items: { type: "object", properties: { name: str, status: { type: "string", enum: ["known", "partial", "unknown"] }, note: str }, required: ["name", "status", "note"] } } },
      required: ["topics"],
    },
  },
];

export type ProbeTopic = { name: string; status: "known" | "partial" | "unknown"; note: string };
export type ProbeResult = { project: string; layer: string; status: "done" | "skipped"; topics: ProbeTopic[]; questions: number; time: string };
export const countsOf = (topics: ProbeTopic[]) => ({ known: topics.filter((t) => t.status === "known").length, partial: topics.filter((t) => t.status === "partial").length, unknown: topics.filter((t) => t.status === "unknown").length });

// One running Probe. `abort` ends the Prober and withdraws the question it waits on.
export type ProbeRun = { project: string; layer: string; asked: number; ideas: Set<string>; abort: AbortController; closed: "done" | "skipped" | undefined };

// The stored results (probes.jsonl: one line per result, the last for a Project and layer wins; memory only without a folder)
// and the Probes running now.
export function createProbes(dir?: string) {
  const file = dir && join(dir, "probes.jsonl");
  const key = (project: string, layer: string) => JSON.stringify([project, layer]);
  const results = new Map<string, ProbeResult>();
  if (file && existsSync(file)) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      try {
        const r = JSON.parse(line);
        if (r?.project && isLayer(r.layer)) results.set(key(r.project, r.layer), r);
      } catch {
        // an empty or torn line: skipped
      }
    }
  }
  const runs = new Map<string, ProbeRun>(); // by probe id
  return {
    runs,
    get: (project: string, layer: string) => results.get(key(project, layer)),
    running: (project: string, layer: string) => [...runs.values()].find((r) => r.project === project && r.layer === layer),
    put(r: ProbeResult) {
      if (file) {
        mkdirSync(dir!, { recursive: true });
        appendFileSync(file, "\n" + JSON.stringify(r) + "\n"); // a leading newline: a torn last line cannot swallow this record
      }
      results.set(key(r.project, r.layer), r);
    },
  };
}
export type Probes = ReturnType<typeof createProbes>;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const text = (x: unknown, max: number): x is string => typeof x === "string" && x.trim().length > 0 && x.length <= max;
const STATUSES = ["known", "partial", "unknown"];

// Checks what the Prober handed over. The error text is written for the model: it says what to change.
export function parseTopics(raw: unknown): { topics: ProbeTopic[] } | { error: string } {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20) return { error: "probe_done needs topics: a list of 1 to 20 entries {name, status, note}, one per concept you looked at" };
  const topics: ProbeTopic[] = [];
  for (const [i, t] of raw.entries()) {
    const at = `topics[${i}]`;
    if (!isObj(t)) return { error: `${at} must be an object {name, status, note}` };
    const extra = Object.keys(t).find((k) => !["name", "status", "note"].includes(k));
    if (extra) return { error: `${at} has an unknown field "${extra}": use only name, status and note` };
    if (!text(t.name, 200)) return { error: `${at}.name must be the concept's name, as text of at most 200 characters` };
    if (typeof t.status !== "string" || !STATUSES.includes(t.status)) return { error: `${at}.status must be one of known, partial, unknown` };
    if (typeof t.note !== "string" || t.note.length > 500) return { error: `${at}.note must be text of at most 500 characters: one sentence on where their understanding ends` };
    topics.push({ name: t.name.trim(), status: t.status as ProbeTopic["status"], note: t.note.trim() });
  }
  return { topics };
}

// The idea on the Learner graph that a name (normalised) stands for, under its name or an alias. This is what "held" means for the Probe.
export const heldIdea = (core: Core, idea: string) => core.learner.graph().propositions.find((p) => [p.name, ...p.aliases].some((n) => normalise(n) === idea));

// A class goes further than the Probe: the graph holds what the Teacher taught, so an idea also needs strong Evidence in this Project before the Teacher is told to skip it:
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

type Reply = { text: string; isError?: true };
const err =(text: string): Reply => ({ text, isError: true });
const ok = (x: object): Reply => ({ text: JSON.stringify({ ok: true, ...x }) });

// Runs one of the Prober's tools. Null when the tool is not one of its own.
export async function runProbeTool(name: string, args: Record<string, unknown>, { core, token, gaveUp }: { core: Core; token: string; gaveUp: AbortSignal }): Promise<Reply | null> {
  const conversation = core.permissions.conversationOf(token);
  const probeId = conversation?.classId;
  const run = probeId ? core.probes.runs.get(probeId) : undefined;
  const project = conversation && core.projects.get(conversation.project);
  if (!conversation || !probeId || !run || !project) return err("The Probe is not running");

  if (READ_TOOLS.some((t) => t.name === name)) return runReadTool(name, args, core, project);
  if (!PROBE_TOOLS.some((t) => t.name === name)) return null;
  if (run.closed === "skipped") return err("The person skipped the Probe. Do not ask anything else: end your turn.");
  if (run.closed) return err("The Probe is finished. End your turn.");

  if (name === "known_ideas") return ok({ ideas: core.learner.graph().propositions.map((p) => p.name) });

  if (name === "probe_done") {
    const parsed = parseTopics(args.topics);
    if ("error" in parsed) return err(parsed.error);
    const result: ProbeResult = { project: run.project, layer: run.layer, status: "done", topics: parsed.topics, questions: run.asked, time: new Date().toISOString() };
    core.probes.put(result);
    run.closed = "done";
    conversation.emit({ type: "probe_done", layer: run.layer, topics: result.topics, counts: countsOf(result.topics), questions: run.asked });
    return ok({ next: "The Probe is finished. Say one short closing sentence and end your turn." });
  }

  // ask
  const raw = typeof args.idea === "string" ? args.idea : "";
  const idea = normalise(raw);
  if (!raw.trim() || raw.length > 200 || !idea) return err("ask needs `idea`: the short name of the concept this question measures, for example \"container\"");
  if (run.asked >= MAX_PROBE_QUESTIONS) return err(`You have already asked ${MAX_PROBE_QUESTIONS} questions, the most a Probe allows. Call probe_done now with what you found.`);
  const held = heldIdea(core, idea);
  if (held) return err(`The Learner graph already holds "${held.name}": the person has shown they understand it. Count it as known, and ask about a different concept (or call probe_done if nothing else is left).`);
  if (run.ideas.has(idea)) return err(`You already asked about "${raw.trim()}" in this Probe. Ask about a different concept, or call probe_done.`);
  const parsed = parseQuestion(args);
  if ("error" in parsed) return err(parsed.error);
  run.asked++;
  run.ideas.add(idea);
  const q = { ...parsed.question, idea, skippable: true as const, probe: { n: run.asked, of: MAX_PROBE_QUESTIONS } };

  // The question is withdrawn if the Prober stops waiting, the person closes the stream or the person skips the Probe.
  const result = await core.permissions.askQuestion(token, q, AbortSignal.any([gaveUp, run.abort.signal]));
  if (!result) return err("The Probe is not running");
  if (!result.heard) return { text: result.text, isError: result.isError };
  const { heard } = result;
  try {
    const base = heard.answer.skip
      ? ({ classId: probeId, questionId: heard.questionId, project: project.id, kind: "probe-skip", correct: null, confidence: null, answer: null, thought: heard.answer.thought ?? null, dontKnow: false, time: new Date().toISOString() } satisfies Evidence)
      : evidenceOf(probeId, heard.questionId, project.id, q, heard.answer);
    core.learner.recordEvidence({ ...base, phase: "probe", idea });
  } catch (e) {
    console.error(e); // a ledger that cannot be written must not stop the Probe
  }
  return ok({
    ...(JSON.parse(result.text) as object),
    idea,
    questionsLeft: MAX_PROBE_QUESTIONS - run.asked,
    next: run.asked >= MAX_PROBE_QUESTIONS ? "That was the last question. Call probe_done now." : "Ask about another concept, or call probe_done if you have enough.",
  });
}
