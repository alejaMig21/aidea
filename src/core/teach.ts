// The order of a class. The Teacher calls begin_step, predict, explain, ask (the check) and finish_class; this file decides, per class,
// which call is allowed next and answers the ones that are not with plain words naming what to do. The model cannot skip the order.
//   new -> (predict answered) predicted -> (explain) explained -> (check right) closed
//                                                    explained -> (check wrong) missed -> (explain again) explained
import { evidenceOf } from "./learner.ts";
import type { Evidence } from "./learner.ts";
import { callRole } from "./learner-pipeline.ts";
import { runAuthoringTool } from "./tutor-authoring.ts";
import { itemFor, runPlanTool } from "./plan.ts";
import { answerForTutor, parseQuestion } from "./tutor.ts";
import type { Answer, Question } from "./tutor.ts";
import type { Core } from "./types.ts";

type State = "new" | "predicted" | "explained" | "missed" | "closed";
type Step = { title: string; item?: string; state: State; predicts: number; checks: number };
type Failure = { error: string };

const MAX_PROSE = 4000;
const nonEmpty = (v: unknown, max: number): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= max;

// What the model should do next, by the state the open step is in.
const WHAT_NEXT: Record<State, string> = {
  new: "ask the person to predict with predict",
  predicted: "teach it with explain",
  explained: "check it with ask (give its stepId)",
  missed: "the check was missed: re-teach it with a new explain for the same step, then check again with ask",
  closed: "",
};

export function createLesson() {
  const steps = new Map<string, Step>();
  let open: string | undefined;
  let finished = false;
  const elements = new Map<string, { questionId: string; text: string }>(); // layer elements the person has answered about (co-authoring)
  let reviewDue: string | undefined; // the idea of a review question the first step waits for
  let reviewIdea: string | undefined; // the same idea, until the question has been asked
  const texts: string[] = []; // every explanation, in order: the Teacher's prose for the Learner graph

  const stepOf = (id: unknown, call: string): Step | Failure => {
    if (finished) return { error: "The class is finished. End your turn." };
    if (!nonEmpty(id, 100)) return { error: `${call} needs a stepId: the id you gave the step in begin_step` };
    const step = steps.get(id);
    if (!step) return { error: `There is no step "${id}". Call begin_step with a stepId and a title first.` };
    if (id !== open) return { error: `Step "${id}" is already closed. The open step is ${open ? `"${open}"` : "none"}.` };
    return step;
  };
  const failed = (x: Step | Failure): x is Failure => "error" in x;

  return {
    texts,
    elements,
    isFinished: () => finished,
    setReview(idea: string) {
      reviewDue = reviewIdea = idea;
    },
    // The review question: one, before the first step, about the idea the core chose.
    review(args: Record<string, unknown>): Failure | { question: Question } {
      if (!reviewIdea) return { error: reviewDue === undefined && !steps.size ? "No review question is due in this class. Go on with begin_step." : "The review question was already asked. Go on with begin_step." };
      const parsed = parseQuestion(args);
      if ("error" in parsed) return parsed;
      const q = parsed.question;
      if (q.kind === "text" && !nonEmpty(q.expected, MAX_PROSE)) return { error: "A text review question needs `expected`: the answer you have in mind, fixed before the question is shown" };
      const idea = reviewIdea;
      reviewIdea = undefined;
      return { question: { ...q, phase: "review", idea } };
    },
    reviewAnswered() {
      reviewDue = undefined;
    },
    openStep: () => open,

    begin(args: Record<string, unknown>, item?: string): Failure | { stepId: string } {
      if (finished) return { error: "The class is finished. End your turn." };
      if (reviewDue) return { error: "Ask the review question first, with review, as your first message said. begin_step is refused until the person has answered it (\"I don't know\" counts)." };
      const { stepId, title } = args;
      if (!nonEmpty(stepId, 100)) return { error: "begin_step needs a stepId: a short unique id for the step" };
      if (!nonEmpty(title, 200)) return { error: "begin_step needs a title: a few words naming the step" };
      if (open) return { error: `Step "${open}" is still open: ${WHAT_NEXT[steps.get(open)!.state]}. Finish it before beginning another step.` };
      if (steps.has(stepId)) return { error: `A step called "${stepId}" already exists. Use a new stepId for a new step.` };
      steps.set(stepId, { title: title.trim(), ...(item ? { item } : {}), state: "new", predicts: 0, checks: 0 });
      open = stepId;
      return { stepId };
    },

    // The prediction question for the open step. It can be asked again only while it has not been answered.
    predict(args: Record<string, unknown>): Failure | { question: Question } {
      const step = stepOf(args.stepId, "predict");
      if (failed(step)) return step;
      if (!nonEmpty(args.prompt, MAX_PROSE)) return { error: "predict needs a prompt: the open question you want the person to answer" };
      if (step.state !== "new") return { error: `Step "${args.stepId}" already has its prediction: ${WHAT_NEXT[step.state]}.` };
      step.predicts++;
      return { question: { kind: "text", prompt: args.prompt.trim(), allowDontKnow: true, stepId: args.stepId as string, ...(step.item ? { item: step.item } : {}), phase: "predict", attempt: step.predicts } };
    },
    predicted(stepId: string) {
      const step = steps.get(stepId);
      if (step?.state === "new") step.state = "predicted";
    },

    explain(args: Record<string, unknown>): Failure | { repair: boolean } {
      const step = stepOf(args.stepId, "explain");
      if (failed(step)) return step;
      if (!nonEmpty(args.text, MAX_PROSE)) return { error: `explain needs text: the explanation, at most ${MAX_PROSE} characters` };
      if (step.state === "new") return { error: `Step "${args.stepId}" has no prediction yet. Call predict first and wait for the person's answer; open your explanation by resolving it.` };
      if (step.state === "explained") return { error: `Step "${args.stepId}" is already explained. Check it with ask (give its stepId) before teaching more.` };
      const repair = step.state === "missed";
      step.state = "explained";
      texts.push(args.text.trim());
      return { repair };
    },

    // The check question for the open step, with its correct answer committed.
    check(args: Record<string, unknown>): Failure | { question: Question } {
      const step = stepOf(args.stepId, "A check (ask)");
      if (failed(step)) return step;
      if (step.state === "new" || step.state === "predicted") return { error: `Step "${args.stepId}" has not been explained yet: ${WHAT_NEXT[step.state]}.` };
      if (step.state === "missed") return { error: `Step "${args.stepId}" was missed. Re-teach it with a new explain for the same step before checking again.` };
      const parsed = parseQuestion(args);
      if ("error" in parsed) return parsed;
      const q = parsed.question;
      if (q.kind === "text" && !nonEmpty(q.expected, MAX_PROSE)) return { error: "A text check needs `expected`: the answer you have in mind, fixed before the question is shown" };
      step.checks++;
      return { question: { ...q, stepId: args.stepId as string, ...(step.item ? { item: step.item } : {}), phase: "check", attempt: step.checks } };
    },
    // The verdict of a check: right closes the step, wrong leaves it open for a re-teach.
    checked(stepId: string, correct: boolean) {
      const step = steps.get(stepId)!;
      step.state = correct ? "closed" : "missed";
      if (correct) open = undefined;
    },

    finish(args: Record<string, unknown>): Failure | { summary: string } {
      if (finished) return { error: "The class is finished. End your turn." };
      if (open) return { error: `Step "${open}" is still open: ${WHAT_NEXT[steps.get(open)!.state]}. Close it before finish_class.` };
      if (!steps.size) return { error: "No step was taught. Begin one with begin_step, or end your turn." };
      if (!nonEmpty(args.summary, MAX_PROSE)) return { error: "finish_class needs a summary: one or two sentences on what was covered" };
      finished = true;
      return { summary: args.summary.trim() };
    },
  };
}

export type Lesson = ReturnType<typeof createLesson>;

// ---- The grader: one free-text answer against the answer the Teacher committed.
const GRADE_SCHEMA = {
  type: "object",
  properties: { correct: { type: "boolean" }, feedback: { type: "string" } },
  required: ["correct", "feedback"],
};
const GRADE_INSTRUCTIONS =
  "You grade one short answer. You get a question, the expected answer and the person's answer. " +
  "correct is true when the person expresses the expected idea, even in different words; false when the key idea is missing, wrong or only hinted at. " +
  "feedback is one plain sentence for the teacher naming what the person got right or missed. Answer with the JSON only.";

async function grade(core: Core, q: Question & { kind: "text" }, a: Answer): Promise<{ correct: boolean; feedback: string }> {
  const out = (await callRole(core.adapter, "grader", GRADE_INSTRUCTIONS, `Question: ${q.prompt}\nExpected answer: ${q.expected}\nPerson's answer: ${a.text}`, GRADE_SCHEMA, core.learner.model)) as any;
  if (typeof out?.correct !== "boolean" || typeof out?.feedback !== "string") throw new Error("the grader returned an invalid verdict");
  return out;
}

type Reply = { text: string; isError?: true };
type Ctx = { core: Core; token: string; lesson: Lesson; gaveUp: AbortSignal };
const err = (text: string): Reply => ({ text, isError: true });
const ok = (x: object): Reply => ({ text: JSON.stringify({ ok: true, ...x }) });

// Runs one of the loop's tools for a class.
export async function runTeachTool(name: string, args: Record<string, unknown>, { core, token, lesson, gaveUp }: Ctx): Promise<Reply> {
  const conversation = core.permissions.conversationOf(token);
  if (!conversation?.classId) return err("The class is not running");
  const { classId, project } = conversation;
  const record = (q: Question, a: Answer, questionId: string, graded?: boolean, extra: Partial<Evidence> = {}) => {
    try {
      const e = { ...evidenceOf(classId, questionId, project, q, a, graded), ...extra };
      core.learner.recordEvidence(e);
      return e;
    } catch (e) {
      console.error(e); // a ledger that cannot be written must not stop the class
    }
  };

  const authored = await runAuthoringTool(name, args, { core, token, lesson, gaveUp });
  if (authored) return authored;

  if (name === "set_plan" && lesson.openStep()) return err(`Step "${lesson.openStep()}" is still open. Close it (its check must be answered correctly) before changing the Plan, so no question goes out about something the Plan no longer holds.`);
  const planned = runPlanTool(name, args, core, project, (e) => conversation.emit(e));
  if (planned) return planned.isError ? err(planned.text) : { text: planned.text };

  if (name === "begin_step") {
    const planItem = itemFor(core, project, args.item);
    if ("error" in planItem) return err(planItem.error);
    const r = lesson.begin(args, planItem.item);
    if ("error" in r) return err(r.error);
    conversation.emit({ type: "tutor_step", stepId: r.stepId, title: String(args.title).trim() });
    return ok({ stepId: r.stepId, next: "Now call predict for this step." });
  }

  if (name === "explain") {
    const r = lesson.explain(args);
    if ("error" in r) return err(r.error);
    conversation.emit({ type: "tutor_explain", stepId: args.stepId, text: String(args.text).trim(), repair: r.repair });
    return ok({ next: "Now check the step with ask (give its stepId)." });
  }

  if (name === "finish_class") {
    const r = lesson.finish(args);
    if ("error" in r) return err(r.error);
    conversation.emit({ type: "tutor_finished", summary: r.summary });
    return ok({ next: "The class is finished. End your turn." });
  }

  if (name === "review") {
    const asked = lesson.review(args);
    if ("error" in asked) return err(asked.error);
    const q = asked.question;
    const result = await core.permissions.askQuestion(token, q, gaveUp);
    if (!result) return err("The class is not running");
    if (!result.heard) return { text: result.text, isError: result.isError };
    const { heard } = result;
    const a = heard.answer;
    const evidence = { phase: "review" as const, idea: q.idea };
    let correct = false;
    let feedback: string | undefined;
    if (!a.dontKnow && q.kind === "choice") correct = a.option === q.correct;
    else if (!a.dontKnow && q.kind === "text") {
      try {
        ({ correct, feedback } = await grade(core, q, a));
      } catch (e) {
        console.error(e);
        record(q, a, heard.questionId, undefined, evidence); // the answer is kept; nothing is counted
        lesson.reviewAnswered();
        return ok({ next: "The grader could not judge this answer, so nothing was counted. Go on with begin_step." });
      }
    }
    const entry = record(q, a, heard.questionId, q.kind === "text" && !a.dontKnow ? correct : undefined, evidence);
    lesson.reviewAnswered();
    return ok({
      ...(JSON.parse(result.text) as object),
      correct,
      ...(feedback ? { feedback } : {}),
      ...(entry?.sureAndWrong ? { sureAndWrong: true } : {}),
      next: "Say one short line about it, without teaching the answer, and go on with begin_step.",
    });
  }

  // predict and ask pose a question and wait for the person.
  const posed = name === "predict" ? lesson.predict(args) : lesson.check(args);
  if ("error" in posed) return err(posed.error);
  const q = posed.question;
  const result = await core.permissions.askQuestion(token, q, gaveUp);
  if (!result) return err("The class is not running");
  if (!result.heard) return { text: result.text, isError: result.isError };
  const { heard } = result;
  const stepId = q.stepId!;

  if (q.phase === "predict") {
    record(q, heard.answer, heard.questionId);
    lesson.predicted(stepId);
    return ok({
      stepId,
      ...(heard.answer.dontKnow ? { prediction: null, dontKnow: true } : { prediction: heard.answer.text }),
      ...(heard.answer.thought ? { thought: heard.answer.thought } : {}),
      next: "Now call explain for this step. Open it by resolving their prediction: what they said, what is true, and why.",
    });
  }

  // A check. A choice is graded by the program, a text answer by the grader against the committed answer.
  const a = heard.answer;
  let correct: boolean;
  let feedback: string | undefined;
  if (a.dontKnow) correct = false;
  else if (q.kind === "choice") correct = a.option === q.correct;
  else {
    try {
      ({ correct, feedback } = await grade(core, q, a));
    } catch (e) {
      console.error(e);
      record(q, a, heard.questionId); // the answer is kept; nothing is counted
      return err("The grader could not judge this answer, so nothing was counted and the step stays as it was. Check the step again with a different question.");
    }
  }
  const entry = record(q, a, heard.questionId, q.kind === "text" && !a.dontKnow ? correct : undefined);
  lesson.checked(stepId, correct);
  const sureAndWrong = entry?.sureAndWrong === true;
  return ok({
    ...(JSON.parse(result.text) as object),
    correct,
    ...(feedback ? { feedback } : {}),
    stepId,
    attempt: q.attempt,
    stepClosed: correct,
    ...(sureAndWrong ? { sureAndWrong } : {}),
    next: correct
      ? "The step is closed. Say so in a few words, then begin the next step with begin_step, or call finish_class if the topic is done."
      : sureAndWrong
        ? "The person was sure and wrong: treat it as a firm misconception. Name the mistaken idea and repair it with a new explain for this step before anything else, then check again. begin_step is refused until this step is answered correctly."
        : "The step stays open. Work out what they believe, re-teach it with a new explain for the same step, then check again. begin_step is refused until this step is answered correctly.",
  });
}
