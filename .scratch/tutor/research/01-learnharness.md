# Research 01: LearnHarness (ideas for aidea's Tutor)

Repo: https://github.com/amosblomqvist/learnharness (AGPL-3.0). Read 2026-10-28. Nothing below is copied; all paraphrase. Source shorthand: `RAW` = https://raw.githubusercontent.com/amosblomqvist/learnharness/HEAD/ (so "RAW docs/architecture.md" is that base plus the path).

## TL;DR

- LearnHarness is a desktop/web app (Next.js + Electron) where one learner talks to teaching agents; knowledge accumulates in a cross-session graph of true propositions plus reasoning chains (README https://github.com/amosblomqvist/learnharness).
- The README's four phases map to: a Prober agent (Measure), a Teacher that authors a plan DAG (Plan), the Teacher's predict/teach/check loop (Teach), and separate Practice sessions (RAW docs/architecture.md, RAW docs/probe-teach-split.md).
- Probe and teach are two agents sharing one message history; the seam is a server tool `probe_done` carrying per-strand floor/ceiling (RAW docs/probe-teach-split.md).
- A prediction is its own turn, about the next untaught step; checks come after teaching, behind a reveal button (RAW src/agent/prompts/teacher/28-predictions.md, 20-teaching.md).
- Each quiz answer carries 0-100 self-reported confidence plus optional free-text "thinking"; the prompt reads confidence x correctness as a 2x2 (RAW src/agent/prompts/shared/25-confidence.md, RAW skills/learnharness/references/data-format.md).
- Graph = append-only JSONL ledgers of propositions and chains; the view is rebuilt on read; understanding is never stored (RAW docs/vision.md, docs/architecture.md).
- Graph is built by a separate pipeline: extractor (LLM) -> auditor (LLM) -> deterministic merger; it reads only the teacher's prose (RAW docs/architecture.md).
- Later sessions do NOT get graph context injected; the agent may call read-only graph tools (RAW docs/architecture.md). vision.md says the opposite (older intent).
- Research, demo (sandboxed HTML), visual (SVG) are fire-and-forget background sub-agent jobs, verified by running/rendering (RAW docs/architecture.md, docs/vision.md).
- Biggest difference from aidea: LearnHarness teaches a named topic in a vacuum; aidea's Tutor interrupts a live coding project at Blocking decisions.
- Licence: AGPL-3.0; taking ideas without copying wording or code is generally fine, but this is not legal advice.

## 1. Workflow of a session

1. **Measure (Prober).** The Prober asks the learner's goal via `ask_user_question`, then quizzes to find, per dependency "strand", a floor (hardest thing reliably right) and a ceiling (easiest thing wrong or unknown). It opens near the hardest thing the goal needs, jumps up on confident-correct, steps gently on hesitant-correct, narrows on wrong, and probes around misses to tell slip from gap from misconception (RAW src/agent/prompts/prober/10-probe-doctrine.md).
2. **Stop rule.** Stop when every strand is bracketed and the goal is concrete; call `probe_done` once; it is refused while a question is open (same source).
3. **Handoff.** The server's wake pipeline triggers a Teacher turn; the learner sees one continuous chat. If the wake is lost, the next client message still builds the Teacher, because the transcript is the truth (RAW docs/probe-teach-split.md).
4. **Plan (Teacher).** The Teacher maps the field's basics, compares them with the learner's level, prunes what is known, and authors a dependency map of structural landmarks via `plan_init`, validated as a DAG. It explains the approach in a few sentences and ends the turn to wait for a go-ahead (RAW src/agent/prompts/teacher/10-planning.md; RAW docs/architecture.md).
5. **Teach loop, per step.** Predict (own turn, next untaught step) -> resolve the prediction at the start of the explanation -> teach one fact -> graded check -> if wrong, diagnose, re-teach, strengthen before continuing (RAW 28-predictions.md, 20-teaching.md under src/agent/prompts/teacher/).
6. **Adapt.** The plan is a hypothesis; the Teacher adds missing foundations or removes known material, and fills gaps one small step at a time (RAW 10-planning.md). vision.md describes editing through schema-validated tools such as add_node/reparent/set_current (RAW docs/vision.md); the architecture doc names only `plan_init`, so the current tool set is unverified.
7. **Background jobs** run in parallel; results are injected as a steering message when the session is idle (section 3).
8. **Graph extraction** runs outside the session, triggered by token coverage of un-extracted teacher text (RAW docs/architecture.md).
9. **Practice sessions** are separate: a partitioner splits chosen chains into one target per problem; a generator writes problem, solution and rubric together; a grader scores 0-10 with brief reasoning (RAW docs/architecture.md). Problems target ideas already taught but not reliably recalled, in three forms (recall, discrimination, composition), aiming near 85% success per retrieval step (RAW src/agent/prompts/practice/10-doctrine.md).

## 2. Roles and what the agent may and may not do

- **Prober**: tools `quiz`, `ask_user_question`, `probe_done`, plus read-only graph tools, `read`, `pdf`, sparing `research`. Its quiz schema has no `nodeId` field, so the model never sees a field it must not use (RAW docs/probe-teach-split.md; RAW 10-probe-doctrine.md).
- **Teacher**: teach quiz, `plan_init`, job tools (`research`, `demo`, `visual`), graph tools (RAW docs/architecture.md).
- **Sub-agents**: researcher, demo-builder, visual-maker run in the background; demo-builder runs its HTML headless to verify; visual-maker renders and inspects its SVG (RAW docs/architecture.md).
- **Extractor / auditor / merger**: the extractor sees only teacher prose (not learner messages, tool calls, quiz blocks); the auditor sees only propositions, uses read-only graph tools, decides identity; only the deterministic merger writes ledgers (RAW docs/architecture.md).
- **Behavioural limits I could verify**: do not interrupt an explanation with a check; do not let the learner accept unexplained claims on faith; do not label sections as plan nodes; do not narrate the method (RAW 20-teaching.md; RAW docs/teaching-methodology.md). `nodeId` marks position, never completion; there is no "done" ledger, progress is inferred from the transcript (RAW docs/probe-teach-split.md).
- **Dev-side rule, not the tutor**: AGENTS.md says design authority is the human's and the coding agent must ask rather than guess (RAW AGENTS.md).

## 3. Data it keeps (schemas in prose)

Source: RAW skills/learnharness/references/data-format.md unless noted. Format version 1.

- **Layout**: `chats/<session-id>.json`; `graph/nodes.jsonl`; `graph/chains.jsonl`; `graph/sources.json`; `graph/format.json`; `graph/sessions.jsonl` (extraction checkpoints); `graph/coverage.jsonl` (fingerprints of extracted teacher text); `positions.json` and `render-settings.json` (layout only); `jobs/<id>.json`. Learning records are plain files the learner can inspect (README).
- **Session record**: id, title, timestamps, `kind` (teach or practice), version, full `messages`, optional `tree` (nodes, prerequisite edges, revision; positions are scaffolding, not mastery evidence), usage logs, per-session model settings.
- **Messages**: roles user, assistant (text, thinking = the agent's own reasoning, tool calls), toolResult (compact content for the model, richer details), and custom app events (practice-thinking, plan-block, subagent-steer, probe-handoff, compaction).
- **Answer evidence** (in the toolResult details): kind, question text and option snapshots, whether a quiz was a `predict` or a `check`, selected answers (shown shuffled), free text, `dontKnow`, `dismissed`, learner `thinking`, separate `readingThinking`, `confidence` (0-100, self-reported; missing is not zero; a default of 50 cannot be told from a deliberate 50), mechanical `correct`, and teacher-authored `committed` and `explanation`. Wrong answers, skips and don't-knows are kept as evidence. Recall and explain answers have no numeric grade.
- **Proposition** (nodes.jsonl line): id, short non-unique `name`, full `statement`, `aliases`, `createdAt`, `provenance` (list of chat id + message id pairs). Same-id lines merge: first line wins name and date, later statements become aliases, provenance is unioned. Different ids never merge by label similarity.
- **Chain** (chains.jsonl line): id, `premises` (node ids, jointly required), `conclusion`, createdAt, provenance. Chains with the same conclusion are separate arguments; duplicates merge by sorted premises plus conclusion.
- **Graph design rules** (RAW docs/vision.md): every node is a true proposition; misconceptions are not nodes (a myth enters as its correction; the learner's wrong belief lives only in the event ledger); edge kinds `follows` and `supports` with no stored strength; understanding is derived, never encoded; clusters via Louvain community detection, named by a cheap LLM call. The architecture doc instead says each stored chain becomes an "implication" node in the view (RAW docs/architecture.md), so vision.md's edge model is partly superseded.
- **Plan tree**: stable lowercase node ids, arrows mean "must understand before"; node status (current, visited, upcoming) is derived from tagged quiz calls (RAW 10-planning.md; docs/probe-teach-split.md).
- **Jobs**: result and pending-delivery marker saved together; steering message queued; delivered at the next boundary if the session is live, else once idle with no pending question and with consent; a deterministic marker id prevents double delivery (RAW docs/architecture.md). Artifacts: research = brief plus sources (titles, URLs); PDF = brief plus pages consulted; demo = title, notes, HTML; visual = notes, SVG (data-format.md).
- **How later sessions read the graph**: no injection; the agent chooses to call `list_sessions` / `list_propositions`, read-only and setting-gated (RAW docs/architecture.md; docs/probe-teach-split.md says neither agent gets global graph context "for now"). A companion skill gives other agents read-only Python scripts and tells them not to infer mastery or write (RAW skills/learnharness/SKILL.md).
- **User-editable**: README says chats, graph and settings are local and system prompts are visible and editable (https://github.com/amosblomqvist/learnharness). The file tree shows routes for prompts settings, node edit/delete and note import (GitHub tree via https://api.github.com/repos/amosblomqvist/learnharness/git/trees/HEAD?recursive=1); details unread.

## 4. Prompting patterns worth borrowing as IDEAS (paraphrased)

1. Prediction targets the next, untaught step; it should be guessable from the reasoning so far, nudge at the weak spot without revealing it; a failed attempt still counts; the explanation then opens by resolving "you predicted X, truth is Y, because Z" (RAW 28-predictions.md). Close to aidea's predict-before-reveal.
2. Prediction is open and gates teaching; a check is closed behind a reveal, because a popup question pressures the learner to answer before reading (RAW 28-predictions.md; RAW docs/vision.md).
3. Confidence x correctness: wrong and sure = committed misconception, find the flaw and re-teach around it; right but unsure = fragile, one reinforcing step without praise; wrong and unsure = short correction; "don't know" = honest gap, no confidence recorded. Compare confidence with chance (1/n options) (RAW 25-confidence.md).
4. One fact per step; if it needs two explanations, split it (RAW 20-teaching.md).
5. Repair before moving on: a miss means the step did not land; do not fire another check to escape (RAW 20-teaching.md).
6. Bracket the learner's level with floor and ceiling per strand, starting high (RAW 10-probe-doctrine.md). Could become a cheap per-decision-area entry check.
7. Plan as a hypothesis with permanent node ids, visible to the learner and openly revised (RAW 10-planning.md).
8. Practice hints from the learner's reasoning trace: find the first step they cannot complete; six-level ladder (attention cue, pattern type, category, specific idea, outline, worked step), one level per request; classify misses as recall failure, wrong idea, slip, carelessness or misconception (RAW src/agent/prompts/practice/10-doctrine.md).
9. Solve a practice problem fully before posing it and check for shortcuts that skip the target; store the model solution up front (RAW practice/10-doctrine.md; data-format.md).
10. Derive, do not store: mastery is computed from evidence, never kept as a score; prefer duplicates to wrong merges; judgments by LLM, mechanics by code (RAW docs/vision.md).
11. Keep session scaffolding out of the knowledge base; blind roles (extractor sees only teacher prose, auditor sees only propositions) limit leakage (RAW docs/architecture.md, vision.md).
12. Fire-and-forget research: one specific question per call with a sentence or two of context, keep teaching, correct yourself openly if the result contradicts you, cite sources (RAW 40-jobs.md under src/agent/prompts/teacher/).
13. Verify generated demos and visuals by running or rendering them before delivery (RAW docs/vision.md).
14. Learner reasoning aloud as a diagnostic channel, stored apart from the answer (README; data-format.md).
15. Derive state from the transcript instead of mutable phase fields; hide schema fields a role must not use (RAW docs/probe-teach-split.md).

## 5. Where it differs from aidea's needs

| Topic | LearnHarness | aidea Tutor |
|---|---|---|
| Subject | A topic the learner names, taught in a vacuum | A real project built with a coding agent |
| Initiative | Learner opens a session; Prober starts | Tutor interrupts at Blocking decisions (nothing like it in LH docs read) |
| Unit taught | True propositions and chains in a domain | Engineering decisions in the project across layers Business, Requirements, Architecture, Components, Algorithms, Code |
| Modes | Teach and Practice sessions | Class and Direct modes (no LH equivalent found; unverified) |
| Pre-assessment | Quiz-heavy Prober phase up front | Likely lighter and in context; bracketing could apply per decision |
| Graph content | Objective, learner-independent; misconceptions excluded | aidea's Learner graph needs the learner's own propositions and chains, so wrong beliefs need a home (LH keeps them only in the event ledger) |
| Graph input | Extracted afterwards from teacher prose only; learner text deliberately excluded | aidea could extract from learner predictions and reasoning |
| Graph reading | Opt-in tool calls, no injection | Tutor probably wants targeted recall of past decisions at the right moment; open design choice |
| Coding agent | None | Second agent runs beside it; LH has nothing on coordination to copy |
| Practice | Separate retrieval sessions | Could be spaced re-asks on later decisions |
| Mastery model | Explicitly unsettled in vision.md | Must be decided |

## 6. Licence implications of AGPL-3.0 (facts; not legal advice)

- The root LICENSE is GNU Affero GPL v3, 19 November 2007 (RAW LICENSE). `skills/learnharness/` has its own LICENSE file I did not read.
- Copyright protects expression (code, prompt wording, doc text), not ideas, methods or workflows as such. Re-implementing concepts independently does not, in general, trigger AGPL obligations; those attach to copying, modifying or conveying the Program or a work based on it.
- If code or prompt text were copied or closely paraphrased, the result could be a derivative work, and section 13 would require offering corresponding source to users interacting with the modified version remotely over a network (RAW LICENSE, section 13).
- Prompt text is a grey area (it is text, but also functional). Practical hygiene: write aidea's prompts from concepts, do not paste or translate theirs, keep a note of which idea came from where, credit as inspiration (courtesy, not a licence requirement).
- If aidea is or becomes commercial, or the idea/close-paraphrase line gets blurry, ask a lawyer.

## 7. Not verified / unreadable

- The tree listing was truncated after `src/core/session-find.ts`. Not read: later `src/core/` files, `src/agent/tools/*.ts`, `tools.ts`, `system-prompt.md`, `teacher/05-method.md`, `30-question-principles.md`, `50-demos.md`, `shared/*.md` except 25-confidence, `docs/plan.md`, `docs/development.md`, `docs/pi-engine-swap.md`, compaction docs.
- Pages were summarised by a small model through WebFetch, so no file was read verbatim and paraphrase nuance may be lost.
- When and how the Teacher prompts for free-text "thinking" in teach mode is not in what I read; only its storage and its use in practice are documented. The teaching doc says nothing on don't-know handling beyond re-bracketing with easier questions.
- Plan tree: vision.md (many edit tools) and architecture.md (`plan_init` only) disagree. vision.md also contradicts the architecture doc on graph-context injection and has conflicting math delimiter notes, so it is partly outdated.
- Confusion repair is a prompt-level discipline only; no separate mechanism found.
- How prompt editing works (settings route exists) is not read.
- Mastery state is explicitly unsettled in vision.md, so no proven mastery model to borrow.
- Text of `skills/learnharness/LICENSE` and whether it differs from root AGPL.
