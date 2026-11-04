// The optional review question at the start of a free class: one question, with no hints, about an idea the person met in an earlier class.
// The core chooses the idea (the model cannot choose one it likes): among the ideas taught in this Project (all of them only when it has none),
// the one reviewed longest ago, never one the class is about to teach.
// The answer is Evidence about that idea; it never changes the Learner graph.
import type { Proposition, Provenance } from "./learner.ts";
import { normalise } from "./learner-pipeline.ts";
import type { Core } from "./types.ts";

export type Review = { idea: string; name: string; statement: string };

// Whether a class opens with a review question: on unless the person turned it off for this Project.
export const reviewQuestionOn = (core: Core, project: string) => core.preferences.get(project).reviewQuestion !== false;

// `aboutToTeach` is what names what the class will teach (the topic written in the box): an idea that overlaps it, under its name or an alias, is not a review,
// it is the lesson.
export function pickReview(core: Core, project: string, aboutToTeach: string[]): Review | undefined {
  const topics = aboutToTeach.map(normalise).filter(Boolean);
  const overlaps = (name: string) => topics.some((t) => t.includes(name) || name.includes(t));
  const here = core.learner.evidence({ project });
  const last = new Map<string, string>(); // idea -> time of its latest review in this Project
  for (const e of here) if (e.phase === "review" && e.idea && e.time > (last.get(e.idea) ?? "")) last.set(e.idea, e.time);
  // An idea is of this Project when it says so, or when it was saved before that was recorded and the Evidence of its class belongs to this Project.
  const classesHere = new Set(here.map((e) => e.classId));
  const projectOf = (v: Provenance) => v.project ?? (classesHere.has(v.classId) ? project : undefined);
  const ownIdea = (p: Pick<Proposition, "provenance">) => p.provenance.some((v) => projectOf(v) === project);
  const all = core.learner.graph().propositions;
  const notTheLesson = (p: Proposition) => normalise(p.name) && ![p.name, ...p.aliases].map(normalise).filter(Boolean).some(overlaps);
  // A Project with ideas of its own only reviews those: if the topic rules them all out there is no review, not one about another Project.
  const pool = all.some(ownIdea) ? all.filter(ownIdea) : all;
  const candidates = pool.filter(notTheLesson).map((p) => ({ idea: normalise(p.name), name: p.name, statement: p.statement }));
  // Never reviewed first, then the longest ago; the graph's own order breaks ties, so the choice is the same every time.
  return candidates.sort((a, b) => (last.get(a.idea) ?? "").localeCompare(last.get(b.idea) ?? ""))[0];
}

export const reviewMessage = (r: Review) =>
  `Before the first step, ask ONE review question about an idea from an earlier class: "${r.name}" (${r.statement}). ` +
  "Use the review tool (same arguments as ask: kind, prompt, options and correct, or expected). Ask it plainly, with no hint and no reminder of the idea; the person may answer \"I don't know\". " +
  "begin_step is refused until you have done it. Do not teach the answer: say one short line and go on to the first step.";
