// The Learner's stores, kept in a per-user folder outside any Project (without a folder they live in memory only).
// All three are append-only line files, and the file is the source of truth: a restart replays it.
//   evidence.jsonl      one line per answer the person gave.
//   propositions.jsonl  {"op":"put","proposition":{...}} (the whole idea; the last put for an id wins) or {"op":"delete","id"} (a tombstone).
//   chains.jsonl        the same, with "chain" instead of "proposition".
// A line is written with one append call, so a record is whole or absent; a torn last line (crash) is skipped on load and
// the next append starts on a fresh line. Classes whose pipeline has not finished wait in pending-<class>.json (atomic rename).
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Answer, Question } from "./tutor.ts";

// `project` is the Project of the class the idea came from; ideas saved before it was recorded have none (see ownIdea in review.ts).
export type Provenance = { classId: string; message: number; node?: string; project?: string };
export type Proposition = { id: string; name: string; statement: string; aliases: string[]; provenance: Provenance[] };
export type Chain = { id: string; premises: string[]; conclusion: string; provenance: Provenance[] };
export type Graph = { propositions: Proposition[]; chains: Chain[] };
export type Evidence = {
  classId: string; questionId: string; project: string; kind: "choice" | "text" | "task" | "probe-skip" | "decision-skip" | "run-prediction";
  correct: boolean | null; confidence: number | null; answer: string | null; thought: string | null; dontKnow: boolean; time: string;
  // Present for answers given inside the teach loop: the step, "predict" or "check", the attempt number, and a wrong answer given with confidence 70 or more.
  stepId?: string; phase?: "predict" | "check" | "probe" | "review"; attempt?: number; sureAndWrong?: true;
  // Present for answers given in a Probe or in the review question of a class: phase "probe" or "review" and the idea the question measured (normalised).
  idea?: string;
  // Present for answers in a step that was about a Plan concept (normalised name).
  item?: string;
  // kind "task" (tutor-rewrite 06): the person did something in a plugin and the plugin's named check said whether it was done. `correct` is the check's answer (null for "I don't know").
  check?: { plugin: string; name: string };
  // kind "decision-skip": no longer made (decision classes are gone); ledgers written by earlier versions may still hold it, so it is still read.
  decision?: string;
  // kind "run-prediction": a guess made before a step of a Playback recording (the class id is `run:<recording>`). Never an idea of the Learner graph.
  run?: { recording: string; step: number; name: string };
};
// A class waiting for its pipeline: the Teacher's prose, in the order it was said.
export type PendingClass = { classId: string; project: string; node?: string; texts: string[] };

export function createLearnerStore(dir?: string) {
  const torn = new Set<string>();
  const path = (f: string) => join(dir!, f);
  const lines = (f: string): any[] => {
    if (!dir || !existsSync(path(f))) return [];
    const raw = readFileSync(path(f), "utf8");
    if (raw && !raw.endsWith("\n")) torn.add(f);
    const out: any[] = [];
    for (const line of raw.split("\n")) {
      try {
        if (line) out.push(JSON.parse(line));
      } catch {
        // a torn line: skipped
      }
    }
    return out;
  };
  const append = (f: string, records: object[]) => {
    if (!dir || !records.length) return;
    mkdirSync(dir, { recursive: true });
    appendFileSync(path(f), (torn.delete(f) ? "\n" : "") + records.map((r) => JSON.stringify(r) + "\n").join(""));
  };

  // Replays a put/delete file into a map in first-seen order.
  const replay = <T extends { id: string }>(f: string, key: "proposition" | "chain") => {
    const state = new Map<string, T>();
    for (const r of lines(f)) {
      if (r?.op === "put" && r[key]?.id) state.set(r[key].id, r[key]);
      else if (r?.op === "delete") state.delete(r.id);
    }
    return state;
  };
  let propositions = replay<Proposition>("propositions.jsonl", "proposition");
  let chains = replay<Chain>("chains.jsonl", "chain");
  for (const [id, c] of chains) if (!propositions.has(c.conclusion) || !c.premises.every((p) => propositions.has(p))) chains.delete(id);
  const evidence: Evidence[] = lines("evidence.jsonl");

  const pending = new Map<string, PendingClass>();
  if (dir && existsSync(dir)) {
    for (const f of readdirSync(dir).filter((f) => /^pending-.+\.json$/.test(f))) {
      try {
        const p = JSON.parse(readFileSync(path(f), "utf8"));
        pending.set(p.classId, p);
      } catch {
        // unreadable: left alone
      }
    }
  }

  const diff = <T extends { id: string }>(now: Map<string, T>, next: T[], key: string) => {
    const nextIds = new Set(next.map((x) => x.id));
    return [
      ...next.filter((x) => JSON.stringify(now.get(x.id)) !== JSON.stringify(x)).map((x) => ({ op: "put", [key]: x })),
      ...[...now.keys()].filter((id) => !nextIds.has(id)).map((id) => ({ op: "delete", id })),
    ];
  };

  return {
    graph: (): Graph => ({ propositions: [...propositions.values()], chains: [...chains.values()] }),
    evidence: (filter: { project?: string; classId?: string }) =>
      evidence.filter((e) => (!filter.project || e.project === filter.project) && (!filter.classId || e.classId === filter.classId)),

    addEvidence(e: Evidence) {
      append("evidence.jsonl", [e]);
      evidence.push(e);
    },

    // Replaces the graph with `next`, writing only what changed. Nothing changes in memory if a write fails.
    commit(next: Graph) {
      const p = diff(propositions, next.propositions, "proposition");
      const c = diff(chains, next.chains, "chain");
      append("propositions.jsonl", p);
      append("chains.jsonl", c);
      propositions = new Map(next.propositions.map((x) => [x.id, x]));
      chains = new Map(next.chains.map((x) => [x.id, x]));
    },

    // Deletes an idea and the chains that use it; nothing else. False if there is no such idea.
    remove(id: string) {
      if (!propositions.has(id)) return false;
      const g = this.graph();
      this.commit({
        propositions: g.propositions.filter((x) => x.id !== id),
        chains: g.chains.filter((c) => c.conclusion !== id && !c.premises.includes(id)),
      });
      return true;
    },

    pending: (classId: string) => pending.get(classId),
    savePending(p: PendingClass) {
      if (dir) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(path(`pending-${p.classId}.json.tmp`), JSON.stringify(p));
        renameSync(path(`pending-${p.classId}.json.tmp`), path(`pending-${p.classId}.json`));
      }
      pending.set(p.classId, p);
    },
    dropPending(classId: string) {
      if (dir) rmSync(path(`pending-${classId}.json`), { force: true });
      pending.delete(classId);
    },
  };
}

export type LearnerStore = ReturnType<typeof createLearnerStore>;

// What goes in the ledger for one answer. A choice is graded by the program; a text answer only if the grader judged it
// (`graded`), otherwise `correct` is null. "I don't know" is null too: nothing was demonstrated either way.
export function evidenceOf(classId: string, questionId: string, project: string, q: Question, a: Answer, graded?: boolean, time = new Date().toISOString()): Evidence {
  const dontKnow = a.dontKnow === true;
  const choice = q.kind === "choice" && !dontKnow;
  const correct = choice ? a.option === q.correct : (q.kind === "text" || q.kind === "task") && !dontKnow && graded !== undefined ? graded : null;
  const confidence = choice ? (a.confidence ?? null) : null;
  return {
    classId, questionId, project, kind: q.kind, correct, confidence,
    answer: dontKnow ? null : q.kind === "choice" ? q.options[a.option!] : (a.text ?? null),
    thought: a.thought ?? null, dontKnow, time,
    ...(q.stepId ? { stepId: q.stepId, phase: q.phase === "plan" ? undefined : q.phase, attempt: q.attempt, ...(q.item ? { item: q.item } : {}) } : {}),
    ...(choice && correct === false && (confidence ?? 0) >= 70 ? { sureAndWrong: true as const } : {}),
  };
}
