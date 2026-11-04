const fs = require("fs");
function edit(f, pairs) {
  let t = fs.readFileSync(f, "utf8"); const eol = t.includes("\r\n") ? "\r\n" : "\n";
  for (const [a, b] of pairs) { const A = a.replace(/\n/g, eol), B = b.replace(/\n/g, eol); if (!t.includes(A)) throw new Error("nf " + f + ": " + a.slice(0, 80)); t = t.replace(A, () => B); }
  fs.writeFileSync(f, t);
}
// 1. reviewQuestionOn moves to review.ts; decision-class.ts goes.
edit("src/core/review.ts", [[`export type Review = { idea: string; name: string; statement: string };`, `export type Review = { idea: string; name: string; statement: string };

// Whether a class opens with a review question: on unless the person turned it off for this Project.
export const reviewQuestionOn = (core: Core, project: string) => core.preferences.get(project).reviewQuestion !== false;`]]);
fs.rmSync("src/core/decision-class.ts");
// 2. The Tutor's class route: no decision classes.
edit("src/core/routes/tutor.ts", [
  [`import { DECISION_INSTRUCTIONS, bindDecision, decisionMessage, heldDecision, reviewQuestionOn, unbindDecision } from "../decision-class.ts";\n`, ``],
  [`import { pickReview, reviewMessage } from "../review.ts";`, `import { pickReview, reviewMessage, reviewQuestionOn } from "../review.ts";`],
  [`  const held = body?.decision === undefined ? undefined : heldDecision(core, project.id, body.decision);
  if (held && "error" in held) return reject(400, held.error);
  const opening = held ? decisionMessage(held.proposal) : guide ?`, `  const opening = guide ?`],
  [`on a difference, on a decision or on how aidea works`, `on a difference, on a plugin or on how aidea works`],
  [`  const free = !held && !layer && !difference`, `  const free = !layer && !difference`],
  [`  if (held) bindDecision(classId, held.proposal.id);\n`, ``],
  [`instructions: held ? DECISION_INSTRUCTIONS : TUTOR_INSTRUCTIONS, tools`, `instructions: TUTOR_INSTRUCTIONS, tools`],
  [`    core.lessons.delete(classId);
    unbindDecision(classId);`, `    core.lessons.delete(classId);`],
]);
// 3. Teaching: no hint to "Decide for me".
edit("src/core/teach.ts", [
  [`import { decisionOf } from "./decision-class.ts";\n`, ``],
  [`const MISSES_BEFORE_HINT = 3; // a decision class that keeps being missed offers "Decide for me" (live-findings/04)\n`, ``],
  [`  const misses = lesson.checked(stepId, correct);
  const held = decisionOf(classId);
  if (!correct && misses === MISSES_BEFORE_HINT && held) conversation.emit({ type: "decision_hint", proposal: held });`, `  lesson.checked(stepId, correct);`],
]);
// 4. Agent options: no classMode.
edit("src/core/routes/agent-options.ts", [
  [`import { classModeOf, reviewQuestionOn } from "../decision-class.ts";`, `import { reviewQuestionOn } from "../review.ts";`],
  [`choice: currentChoice(core, project), classMode: classModeOf(core, project), reviewQuestion: reviewQuestionOn(core, project) });
    return true;
  }

  if (req.method === "POST") {`, `choice: currentChoice(core, project), reviewQuestion: reviewQuestionOn(core, project) });
    return true;
  }

  if (req.method === "POST") {`],
  [`    if (body?.classMode !== undefined) {
      if (body.classMode !== "class" && body.classMode !== "direct") return reject('classMode must be "class" or "direct"');
      choice.classMode = body.classMode;
    }
`, ``],
  [`send at least one of mode, model, tutorModel, classMode, reviewQuestion`, `send at least one of mode, model, tutorModel, reviewQuestion`],
  [`    core.send(res, 200, { choice: currentChoice(core, project), classMode: classModeOf(core, project), reviewQuestion: reviewQuestionOn(core, project) });`, `    core.send(res, 200, { choice: currentChoice(core, project), reviewQuestion: reviewQuestionOn(core, project) });`],
]);
// 5. Preferences type.
edit("src/core/preferences.ts", [
  [`// classMode: "class" holds the builder at a Blocking decision until a decision class is answered; absent means "direct".\n`, ``],
  [`Partial<Choice> & { classMode?: "class" | "direct"; reviewQuestion?`, `Partial<Choice> & { reviewQuestion?`],
]);
// 6. Proposals: nothing is held, nothing is "blocking".
edit("src/core/proposals.ts", [
  [`  status: "pending" | "waiting-for-class" | "accepted" | "rejected"; // waiting-for-class: only in what is shown; stored as pending + held`, `  status: "pending" | "accepted" | "rejected";`],
  [`  held?: true; // Class mode: a Blocking decision whose decision class is not yet answered or skipped (see decision-class.ts)
  blocking?: true; // a Blocking decision (declaring a Pattern group); only marked here, the Tutor's classes act on it
`, ``],
  [`kind: "add", nodeId, node: g, status: "pending", blocking: true, secret };`, `kind: "add", nodeId, node: g, status: "pending", secret };`],
]);
