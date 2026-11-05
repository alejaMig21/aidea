// Practice (tutor-rewrite 05), as in LearnHarness: a session of its own, asked for by the person or offered by the Tutor, where the person solves problems on ideas that were taught but are
// not reliably recalled. The core keeps what the model must not be trusted with: the ideas (chosen from the Learner graph, never by the model), the solution and the rubric (not shown
// before the answer), the hints (one level per request from the person, in order, at most six) and the verdict of a practical problem (the plugin's check, never the Tutor).
import { normalise } from "./learner-pipeline.ts";
import type { Answer, Question } from "./tutor.ts";
import { parseQuestion } from "./tutor.ts";
import { heldStrongly } from "./measure.ts";
import { taskProblem, runPluginTeachTool } from "./plugins/teach.ts";
import type { Evidence } from "./learner.ts";
import type { Core } from "./types.ts";

export const MAX_HINTS = 6;
const MAX_PROBLEMS = 12;
const FORMS = ["recall", "discrimination", "composition"];
// One level per request, from the lightest nudge to a worked step.
const LADDER = ["an attention cue: where to look, no more", "the pattern type of the problem", "the category of idea it needs", "the specific idea it needs", "an outline of the steps", "a worked first step"];

type Problem = { idea: string; question: Question; solution: string; requested: number; given: number; answered: boolean };
export const createPracticeState = () => ({ on: false, targets: new Set<string>(), problems: new Map<string, Problem>() });
export type PracticeState = ReturnType<typeof createPracticeState>;

// The ideas of this Project that were taught (the Learner graph) and are not held with strong Evidence: the ones worth practising.
export function practiceTargets(core: Core, project: string): { name: string; statement: string }[] {
  const classesHere = new Set(core.learner.evidence({ project }).map((e) => e.classId));
  const own = core.learner.graph().propositions.filter((p) => p.provenance.some((v) => (v.project ?? (classesHere.has(v.classId) ? project : undefined)) === project));
  return own.filter((p) => !heldStrongly(core, project, normalise(p.name))).map((p) => ({ name: p.name, statement: p.statement }));
}

type Reply = { text: string; isError?: true };
const err = (text: string): Reply => ({ text, isError: true });
const ok = (x: object): Reply => ({ text: JSON.stringify({ ok: true, ...x }) });
const text = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;

export type PracticeCtx = {
  core: Core; token: string; project: string; gaveUp: AbortSignal; state: PracticeState; stepOpen: string | undefined;
  judge: (q: Question, a: Answer) => Promise<{ correct: boolean; feedback?: string } | null>;
  record: (q: Question, a: Answer, questionId: string, graded?: boolean, extra?: Partial<Evidence>) => unknown;
  emit: (event: object) => void;
};

// Runs one of the four practice tools; null when `name` is not one of them.
export async function runPracticeTool(name: string, args: Record<string, unknown>, c: PracticeCtx): Promise<Reply | null> {
  if (!["offer_practice", "practice_targets", "problem", "hint"].includes(name)) return null;
  const { core, state } = c;

  if (name === "offer_practice") {
    if (state.on) return err("This is already a practice session.");
    if (c.stepOpen) return err(`Step "${c.stepOpen}" is still open. Close it before offering practice.`);
    if (!text(args.reason, 500)) return err("offer_practice needs a reason: one or two sentences saying why practice would help now (at most 500 characters)");
    const q: Question = { kind: "choice", prompt: args.reason.trim(), options: ["Practice now", "Not now"], correct: 0, allowDontKnow: false, phase: "offer" };
    const result = await core.permissions.askQuestion(c.token, q, c.gaveUp);
    if (!result) return err("The class is not running");
    if (!result.heard) return { text: result.text, isError: result.isError };
    if (result.heard.answer.option !== 0) return ok({ accepted: false, next: "The person said not now. Go on with what you were doing; do not offer again unless they ask." });
    state.on = true;
    return ok({ accepted: true, next: "The person said yes. Call practice_targets, then pose problems with problem." });
  }

  if (!state.on) return err("This is not a practice session. The person can ask for practice, or you can offer it with offer_practice and wait for their yes.");

  if (name === "practice_targets") {
    const ideas = practiceTargets(core, c.project);
    state.targets = new Set(ideas.map((i) => normalise(i.name)));
    return ok({ ideas, note: ideas.length ? "Write problems only about these ideas, one at a time. Solve each yourself first, then pose it with problem: the solution and the rubric stay with aidea until the person answers." : "There is nothing taught and not yet recalled well. Say so to the person in one sentence and call finish_class." });
  }

  // problem and hint both pose a problem and wait; a hint asked for by the person is answered by the Tutor with hint, which poses the same problem again.
  const pose = async (id: string, p: Problem): Promise<Reply> => {
    const q = { ...p.question, hints: { n: p.given, of: MAX_HINTS } } as Question;
    const result = await core.permissions.askQuestion(c.token, q, c.gaveUp);
    if (!result) return err("The class is not running");
    if (!result.heard) return { text: result.text, isError: result.isError };
    const a = result.heard.answer;
    if (a.hint) {
      if (p.requested >= MAX_HINTS) return pose(id, p); // no hint is left: the same problem waits again
      p.requested++;
      return ok({ problemId: id, hintRequested: true, level: p.requested, of: MAX_HINTS, ladder: LADDER[p.requested - 1], next: `The person asked for hint ${p.requested} of ${MAX_HINTS}. Give a hint that is ${LADDER[p.requested - 1]}, never the answer, with hint {problemId, text}.` });
    }
    let correct = false, feedback: string | undefined, checked: { note: string; result: { ok: boolean; reason?: string } } | undefined;
    if (!a.dontKnow && q.kind === "task") {
      const run = await runPluginTeachTool("check_plugin", { id: q.plugin, name: q.check, args: q.args }, core, {}, { project: c.project });
      if (run?.isError) return err(`The check could not run: ${run.text} The problem stays open: pose it again.`);
      checked = JSON.parse(run!.text);
      correct = checked!.result.ok;
    } else if (!a.dontKnow) {
      const verdict = await c.judge(q, a);
      if (!verdict) { c.record(q, a, result.heard.questionId, undefined, { phase: "practice", idea: p.idea }); p.answered = true; return err("The grader could not judge this answer, so nothing was counted. Pose a different problem."); }
      ({ correct, feedback } = verdict);
    }
    p.answered = true;
    c.record(q, a, result.heard.questionId, a.dontKnow ? undefined : correct, { phase: "practice", idea: p.idea, ...(q.kind === "task" ? { check: { plugin: q.plugin, name: q.check } } : {}) });
    return ok({
      problemId: id, correct, ...(feedback ? { feedback } : {}), hintsUsed: p.given, ...(a.dontKnow ? { dontKnow: true } : {}),
      ...(checked ? { untrusted: true, note: checked.note, check: checked.result } : {}),
      solution: p.solution, // revealed now, after the answer
      next: "Say in one or two sentences where the reasoning first broke (use the rubric you wrote), show the solution, then pose another problem or call finish_class.",
    });
  };

  if (name === "problem") {
    const id = args.problemId;
    if (!text(id, 60)) return err("problem needs a problemId: a short unique id for this problem");
    if (state.problems.has(id)) return err(`A problem called "${id}" was already posed. Use a new problemId for a new problem.`);
    if (state.problems.size >= MAX_PROBLEMS) return err(`That is enough problems for one session (${MAX_PROBLEMS}). Call finish_class.`);
    if (!state.targets.size) state.targets = new Set(practiceTargets(core, c.project).map((i) => normalise(i.name)));
    const idea = typeof args.idea === "string" ? normalise(args.idea) : "";
    if (!idea || !state.targets.has(idea)) return err(`A problem must be about one of the ideas practice_targets lists: ${[...state.targets].join(", ") || "none"}.`);
    if (typeof args.form !== "string" || !FORMS.includes(args.form)) return err(`form must be one of ${FORMS.join(", ")}`);
    if (!text(args.solution, 2000)) return err("problem needs a solution: your own worked answer, written BEFORE you pose it (at most 2000 characters)");
    if (!text(args.rubric, 1000)) return err("problem needs a rubric: what a right answer must contain and what shortcut would skip the idea (at most 1000 characters)");
    if (args.kind === "task") {
      const problem = taskProblem(core, args.plugin, args.check, args.args);
      if (problem) return err(problem);
    }
    const parsed = parseQuestion(args);
    if ("error" in parsed) return err(parsed.error);
    const solution = args.solution.trim();
    const question = { ...parsed.question, ...(parsed.question.kind === "text" ? { expected: `${solution}\nRubric: ${args.rubric.trim()}` } : {}), idea, phase: "practice" } as Question;
    const p: Problem = { idea, question, solution, requested: 0, given: 0, answered: false };
    state.problems.set(id, p);
    return pose(id, p);
  }

  // hint
  const id = typeof args.problemId === "string" ? args.problemId : "";
  const p = state.problems.get(id);
  if (!p || p.answered) return err("There is no open problem with that problemId.");
  if (p.requested <= p.given) return err("No hint was asked for. The person asks for each hint with the Hint button: do not give hints on your own.");
  if (!text(args.text, 600)) return err("hint needs text: the hint itself, at most 600 characters, at the level the result named");
  p.given++;
  c.emit({ type: "tutor_hint", problemId: id, level: p.given, text: args.text.trim() });
  return pose(id, p);
}
