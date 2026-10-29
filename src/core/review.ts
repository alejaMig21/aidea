// The optional review question at the start of a class: one question, with no hints, about an idea the person met in an earlier class.
// The core chooses the idea (the model cannot choose one it likes): the one reviewed longest ago, never one the class is about to teach.
// The answer is Evidence about that idea; it never changes the Learner graph.
import { normalise } from "./learner-pipeline.ts";
import type { Core } from "./types.ts";

export type Review = { idea: string; name: string; statement: string };

// `aboutToTeach` is whatever names the topic of the class (topic, selected text); an idea that overlaps it is not a review, it is the lesson.
export function pickReview(core: Core, project: string, aboutToTeach: string): Review | undefined {
  const topic = normalise(aboutToTeach);
  const last = new Map<string, string>(); // idea -> time of its latest review in this Project
  for (const e of core.learner.evidence({ project })) if (e.phase === "review" && e.idea && e.time > (last.get(e.idea) ?? "")) last.set(e.idea, e.time);
  const candidates = core.learner.graph().propositions
    .map((p) => ({ idea: normalise(p.name), name: p.name, statement: p.statement }))
    .filter((p) => p.idea && !(topic && (topic.includes(p.idea) || p.idea.includes(topic))));
  // Never reviewed first, then the longest ago; the graph's own order breaks ties, so the choice is the same every time.
  return candidates.sort((a, b) => (last.get(a.idea) ?? "").localeCompare(last.get(b.idea) ?? ""))[0];
}

export const reviewMessage = (r: Review) =>
  `Before the first step, ask ONE review question about an idea from an earlier class: "${r.name}" (${r.statement}). ` +
  "Use the review tool (same arguments as ask: kind, prompt, options and correct, or expected). Ask it plainly, with no hint and no reminder of the idea; the person may answer \"I don't know\". " +
  "begin_step is refused until you have done it. Do not teach the answer: say one short line and go on to the first step.";
