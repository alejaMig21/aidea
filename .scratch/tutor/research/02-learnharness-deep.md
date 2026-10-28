# Research 02: LearnHarness, deep read of the real source

Repo: https://github.com/amosblomqvist/learnharness (AGPL-3.0), shallow clone at HEAD `3dd5211` (2026-10-28), read locally with Read/Glob/Grep only; nothing was run, installed or built. Paths below are relative to the repo root. Line numbers are from that clone. Everything is paraphrase; no prompt text or code was copied (a few quotes of 25 words or fewer are marked with their path). Compared with report 01 (`01-learnharness.md`), this pass read the real files, so it corrects several of 01's guesses (section 8 and the last list of the final message).

## TL;DR

- LearnHarness (LH) has three conversation agents sharing one persisted-transcript design: Prober (measure), Teacher (plan then teach), Practitioner (practice sessions). Each is rebuilt statelessly from the saved record on every turn (`src/agent/teacher-agent.ts`, `src/server/chat-handler.ts:384-497`).
- Transitions are derived from transcript events, never stored: `probe_done` result = probe to plan; first quiz or explain call tagged with a plan `nodeId` = plan to teach (`src/core/phases.ts:63-100`). Plan acceptance has no gate; the learner's next message is the go-ahead.
- Teaching unit = predict (open, before teaching, own turn) then teach one step then check (collapsed behind a reveal button) then repair or continue (`prompts/teacher/28-predictions.md`, `20-teaching.md`, `src/core/question-core.ts:223-248`).
- Per-answer evidence = selection, mechanical correctness (MCQ, graded in the browser), 0-100 confidence (MCQ only), two free-text "thinking" channels (on the question; while reading), don't-know, dismissed (`question-core.ts:436-493, 779-802`).
- Free-recall questions force the model to commit its correct answer before posing; the model then grades words against the commitment. MCQ explanation is written before the correct answer on purpose (anti-rationalization, `question-core.ts:176-181`).
- The graph is built only from the teacher's prose, outside the session: extractor (LLM) then auditor (LLM, identity links only) then a pure-code merger. The learner's answers never reach the graph (`src/core/coverage.ts:38-49`).
- The Teacher has no graph tools. Only the Prober and Practitioner get `list_sessions` and `list_propositions` (names only), behind a setting. Architecture doc says otherwise (section 8).
- The agent can read any file on the machine (home-anchored, absolute paths allowed, no allowlist), cannot write or shell out, and gets the web only through a background researcher.
- Prompts are user-overridable per fragment file, switch per fragment, in Settings; nothing else about behavior is user-editable except tool toggles and models.
- LH has nothing for co-authoring an artifact, critiquing an external project, or gating another agent. Closest analogues are in section 9.

## 1. Session lifecycle

| Step | What happens | Trigger to next step | Source |
|---|---|---|---|
| Start | Chat created via `POST /api/chats` (title, `kind` teach or practice, optional picked propositions for practice). Picks become a first custom "graph-context" message (ids, names, statements, chain lines) that is flattened into a user-role message on the wire, with a bracketed preamble marking it as injected context, not learner speech. | Learner's first message | `app/api/chats/route.ts:23-49`, `src/core/native-messages.ts:243-287` |
| Measure (Prober) | Reads own map if graph tools are enabled; pins the goal with `ask_user_question`; reasons out dependency "strands"; brackets each strand with a floor and ceiling via one graded question at a time. | Prober calls `probe_done` (refused while a question is open or if already concluded) | `prompts/prober/10-probe-doctrine.md`, `src/agent/tools/probe.ts:49-99` |
| Handoff | `probe_done` queues a handoff steer through the wake pipeline; the Prober's turn ends; a server-side wake turn builds the Teacher. If the wake is lost, the next learner message still builds the Teacher because the transcript contains a concluded `probe_done`. | Teacher built when the transcript has a clean `probe_done` | `probe.ts:77-88`, `src/server/chat-handler.ts:390`, `docs/probe-teach-split.md` §2 |
| Plan (Teacher) | The wake text asks for the full arc to be reasoned out first, then `plan_init`, then presentation. The Teacher writes an approach in prose plus a mermaid dependency map, then ends its turn. Learner may ask for changes (Teacher re-calls `plan_init` and re-presents) or just reply to proceed. | First quiz or explain call carrying a valid `nodeId` | `src/core/contracts/chat.ts:187-192`, `prompts/teacher/10-planning.md`, `src/agent/tools/plan.ts:62-110` |
| Teach | Loop: predict, then explanation that opens by resolving the prediction, then a check, then repair or next predict. Plan can be rewritten mid-lesson at any time. Background jobs may arrive as steers. | No terminal state. Session ends when the learner stops. | `prompts/teacher/20-teaching.md`, `28-predictions.md` |
| Practice | A separate session of `kind: practice`: Practitioner agent with only `problem` and `conclude` (plus fs, research, pdf, optional graph readers). Poses one problem at a time; each conclude ends the turn; next problem needs an explicit learner go-ahead. | Learner's "next problem" signal or words | `src/agent/tools/practice.ts:72-249`, `prompts/practice/00-base.md` |
| Extraction | After each turn, if the teacher-prose tokens not yet covered reach the budget (setting, factory default 4096, floor 500), the pipeline runs asynchronously. | Token threshold | `src/core/settings.ts:344,417`, `docs/architecture.md:349-371` |

Rules that govern the loop (all code-enforced unless marked prompt):
- One question per turn; a cleanly posed question or problem ends the turn via a stop hook; a failed authoring validation does not end it, the model retries in the same turn (`teacher-agent.ts:155-175, 218`).
- Predictions arrive open; checks and teach-phase asks arrive collapsed behind a "check your understanding" button (`question-core.ts:232-235`).
- Teaching never starts in the plan-presentation turn (prompt rule, `10-planning.md`).
- `nodeId` is a position, not a completion. Current node = node of the latest tagged call; visited = nodes of earlier runs of tagged calls; a failed check moves nothing; nothing is ever marked "done" (`src/core/contracts/plan.ts:82-102`, `docs/probe-teach-split.md` §3).
- Context diet: plan_init and probe_done results are slim acks (the model wrote the payload one message ago), full data goes to `details` for the UI (`plan.ts:95-101`, `probe.ts:88-96`).

## 2. Agent roles

| Role | Purpose | May do | May not do | Source |
|---|---|---|---|---|
| Prober | Find the goal and the learner's edge per strand; write the assessment | Ask graded questions (`probe` MCQ or `recall` free-text), `ask_user_question`, read learner files, `research` and `pdf` jobs, read own graph map (gated), `probe_done` | No plan tools, no demo, no visual; its question schema has no `nodeId` or `type` field | `src/agent/tools.ts:287-348` |
| Teacher | Plan then teach | `quiz` or `explain` (with required `type` and `nodeId`), `ask_user_question`, fs reads, `plan_init`, `research`, `demo`, `visual`, `pdf` | No graph readers (none registered), no web directly, no writes | `tools.ts:434-466` |
| Practitioner | Strengthen retrieval with fresh problems | `problem`, `conclude`, fs reads, `research`, `pdf`, graph readers when gated | No question tools, no plan, no extraction; practice sessions never write the graph | `tools/practice.ts:223-249`, `contracts/chat.ts:24-28` |
| Researcher (background) | Web research brief, sourced | `web_search`, `web_fetch`, PDF download and read tools, max 12 turns | Sees nothing of the lesson | `subagents/researcher.ts` |
| Demo-builder (bg) | Single-file interactive HTML, headlessly tested before delivery | `write_demo`, `run_demo` (headless browser) | Never sees the lesson; brief is its whole world | `subagents/demo-builder.ts` |
| Visual-maker (bg) | One precise SVG, rendered and inspected | `write_svg`, `edit_svg`, `render_svg`; needs vision model | same isolation | `subagents/visual-maker.ts` |
| PDF reader (bg) | Cited brief from a learner PDF | `pdf_info`, `pdf_extract`, `pdf_render`, `pdf_search` | same isolation | `subagents/pdf-reader.ts` |
| Extractor (bg) | Turn teacher prose into propositions and chains | One `submit_findings` call | Sees only teacher prose and that source's own graph digest | `subagents/extraction.ts:401-436` |
| Auditor (bg) | Identity only: which new propositions already exist | `find`, `list_sessions`, `list_propositions` (full statements), one `submit_review` of links | Never sees the source, never restates findings, never creates relations, never drops anything; max 16 turns | `extraction.ts:537-602`, `tools/graph.ts:112-182` |
| Merger | Apply findings plus verdicts to ledgers | Pure code | Not an LLM | `src/core/graph.ts:148-289` |
| Compaction summarizer | Replace old transcript when context is near full | Writes a four-section summary: learner understanding and its evolution, teaching arc, plan tree verbatim, current moment | Rules: no praise, every claim traceable to the transcript | `src/core/compaction.ts:373-405` |

Practice sets as described in `docs/architecture.md` §7 (partitioner, generator per problem, grader) do not exist in the code (section 8).

## 3. Tool surface

Legend: R = reads state, W = writes state, X = spawns background work, C = client-answered (no server execute; the browser grades or collects).

| Tool | Roles | Purpose and inputs (paraphrased) | Effect | Source |
|---|---|---|---|---|
| `probe` | Prober | Graded MCQ: question, 2+ options with stable values, optional multiselect, explanation (written first), correctAnswer by value, details. "I don't know" added automatically. | C: question stored in the record; learner's answer arrives as the tool result. | `tools.ts:205-217`, `question-core.ts:158-193` |
| `recall` | Prober (when free-recall is armed) | Free-text question with a full committed answer. | C | `tools.ts:249-261` |
| `quiz` | Teacher | Same as `probe` plus required `type` (predict or check) and `nodeId` validated against the live plan. | C; also moves the derived plan position | `tools.ts:375-391` |
| `explain` | Teacher (free-recall mode) | Free-text variant of `quiz`, same `type` and `nodeId`. | C | `tools.ts:221-239` |
| `ask_user_question` | Prober, Teacher | One ungraded question for preferences or goals; user can pick Other. | C | `tools.ts:79-95` |
| `probe_done` | Prober | Input is the assessment: list of strands (name plus free-form read of floor, ceiling, misconceptions, what to build from) and an optional summary. | W: queues handoff steer; refuses if question open or already done | `tools/probe.ts`, `contracts/probe.ts:47-72` |
| `plan_init` | Teacher | One mermaid graph block; slugs permanent; arrows mean "must be understood before"; parsed deterministically with line-numbered errors; validated as a DAG; rewrite replaces the whole tree. Description asks for 5 to 15 nodes. | W: saves tree to the chat record | `tools/plan.ts` |
| `research` | Prober, Teacher, Practitioner | One specific question plus optional context. | X: fire-and-forget job; brief arrives later as a steer | `tools/jobs.ts:131-166` |
| `pdf` | same | Path plus the specific question. | X | same |
| `demo`, `visual` | Teacher only | Precise standalone brief; builder sees nothing else. | X | same |
| `read`, `ls`, `find`, `grep` | Prober, Teacher, Practitioner | Home-anchored, read-only (section 6). | R | `tools/read.ts`, `fs-shared.ts` |
| `list_sessions`, `list_propositions` | Prober, Practitioner (gated) | Session index with counts and dates; names (no statements) of propositions born in a session. | R | `tools/graph.ts:41-79` |
| `problem` | Practitioner | statement, mode (recall, discrimination, composition), optional target proposition ids (names resolve to ids; unknown ids rejected), modelSolution committed up front. Ends the turn. | C-like; gate: only one active problem | `tools/practice.ts:72-161` |
| `conclude` | Practitioner | outcome (solved, solvedWithHints, movedOn, surrendered; dismissed is app-synthesized), verdict, hint rung R0 to R5 or null, miss class (cue, discrimination, execution, careless, structural) or null, retest flag. | W: closes the active problem | `practice.ts:165-220` |
| `send_to_user` | all, only if the model id contains "claude" | Verbatim message channel because plain text may be summarized into thinking. | W (display) | `teacher-agent.ts:203-210`, `tools/send-to-user.ts` |
| `submit_findings`, `submit_review` | Extractor, Auditor | The deliverables of those stages. | W into memory of the run; merger writes ledgers | `extraction.ts` |

Two plumbing ideas worth noting:
- Error-back validation: every tool boundary runs the authoring rules in `execute` and returns an error result the model retries in the same turn (nodeId not in plan, correctAnswer not among options, chain endpoints unresolved, extractor message anchor outside the batch). Tool-argument "healing" (string-encoded arrays, quoted bare words) happens before validation (`tools/heal.ts`, `submit-agent.ts:32-46`).
- Probe-phase tools were renamed `probe` and `recall` (2026-10-09) because a shared name with the teach tools made models carry the probe call shape into teaching and drop `nodeId` (`tools.ts:197-204`).

## 4. Prompt design

Composition: one shared base (agent identity, philosophy, accuracy), then the role's numbered fragments in filename order, then shared fragments as a trailing appendix, joined by separators. The practitioner composes only its own folder plus voice, accuracy, thinking-fields and formatting (`prompts/README.md`, `src/agent/prompt-segments.ts:37-43, 62-97`). Tool descriptions are kept mechanical on purpose; doctrine lives in prompts (comment at `tools.ts:99-118`).

**Shared base and voice.**
- Goal is understanding: a fact derivable from foundations the learner already accepts, so it does not rot (`src/agent/system-prompt.md`).
- Optimal teaching depends on the learner's current edge; measure first, then plan, then teach; the system absorbs logistics (ordering, research, fact-finding) so effort goes into the material.
- Voice deletes defaults: no praise, no performed excitement, no agreement bias, no false precision, no moralizing about pace; wrong answers named plainly (`shared/10-voice.md`).
- Accuracy: any doubt about a fact or interpretation is a reason to verify (research job) before teaching; if unresolved, say so aloud and keep a note to revisit at the end (`shared/15-accuracy.md`).

**Teacher method (`teacher/05-method.md`).**
- Principle i: lay unconditional truths first (accept-as-is, no caveats), confirm each foundation before building; "unconditional truth" is distinct from "axiom". Universal statements and real definitions are strong forms.
- Principle ii: every step must feel discoverable; motivate why this move (3Blue1Brown as the reference).
- Payoff is "the click": loose facts collapsing into a generated structure. Reason: the brain hedges on facts that something deeper might contradict.

**Planning (`10-planning.md`).** Think hard; scope the field; dispatch research if the picture is unclear; plan the minimal tree (skip what he holds, skip what is off-path); stress-test every "root" for being a disguised theorem; slugs permanent; map is a hypothesis revised openly when teaching reveals something different; repair missing ground one landed step at a time, never with a wall of text; presenting ends the turn and teaching does not start in it.

**Teaching (`20-teaching.md`).**
- One step, one fact; if it needs two explanations it is two steps.
- Present per step as clearly as possible; do not narrate the choreography; never label turns after plan nodes.
- Check every step; a miss means diagnose, repair, strengthen before building further; anything he must take on faith is either made easy to accept or checked.
- Socratic or expository per step, chosen by whether he can plausibly reason it out and by apparent energy. A question with a right answer is still graded even when posed Socratically.
- Pacing: teach first, check second; never fire a check mid-explanation; a wrong answer resumes teaching.

**Predict then check (`28-predictions.md`).**
- Prediction: before teaching, own turn, about the next untaught step, a nudge toward the weak spot that reveals nothing more; need not be derivable; a failed attempt is fine because the attempt is the point; the following explanation opens by resolving it (what he said, what is true, why). Skipped when there is no meaningful next step.
- Check: after teaching, answerable by reasoning from the session, application over recitation, a miss must name the wrong model (`30-question-principles.md`).

**Question craft (`shared/20-question-tools.md`).** Options are bare claims with no reasoning inside, built by mutating the correct claim into believable distractors under specific misconceptions; no asymmetric bolding; regenerate if the right one can be spotted without knowing the material. Free recall: grade strictly against the commitment, near-miss named as partial, genuine "don't know" is a gap not an error. His thinking fields may be dictated speech, so read leniently for transcription noise.

**Thinking fields (`shared/16-mental-model.md`).** They are the primary data: one answer is one bit, the thinking is the picture. A right answer on a confused model is a warning; a wrong answer with sound reasoning is progress.

**Confidence (`shared/25-confidence.md`).** Compare to chance (1/n options). Right and sure = move on; right and unsure = fragile, one reinforcing touch, no celebration; wrong and sure = the strongest signal, name the crack and re-teach around it; wrong and unsure = small correction; don't-know = honest gap, no confidence recorded. Confidence slider snaps to 0, 30, 50, 70, 90, 100 with 50 as default, so an untouched 50 and a chosen 50 are the same number (`question-core.ts:495-501`).

**Confusion repair.** Only prompt discipline plus the check-miss rule above; there is no repair mechanism in code (no flag, no counter, no re-check scheduler).

**How plans are revised.** Teacher re-calls `plan_init` whole; new tree replaces the old; slugs of surviving nodes stay stable by convention; derived statuses ignore ids no longer in the tree (`contracts/plan.ts:82-102`). Learner reaction before teaching begins is a normal chat reply.

**How background jobs are requested (`teacher/40-jobs.md`, `50-demos.md`).** Dispatch before the fact is stated, say so, keep teaching, never wait or poll, never fabricate; one specific question per call plus a sentence of context because the worker sees nothing else; cite sources when the brief lands; correct yourself openly if contradicted; a bare tool call with no surrounding text is a failed turn; when a demo arrives, reference its controls by name. Aborted jobs arrive as a one-line notice to acknowledge in a sentence.

**Prober doctrine (`prober/10-probe-doctrine.md`).** Read the persistent map first (if tools exist); make the goal concrete by interrogating it, and if the learner does not know the terrain record that the goal starts with orientation, never draw the map yourself; reason out strands bounded by relevance; open near the top, not the bottom (adults reaching for advanced material almost always hold the basics); strands inform each other; correct and confident means jump sharply, correct but hesitant means step up gently, wrong means narrow in; a miss is one coordinate, probe around it to tell slip from gap from misconception; a strand that never breaks is not done; every question must move an edge. Conclude with one `probe_done`.

**Practice doctrine (`practice/10-doctrine.md`, 15 KB).** Practice makes held knowledge come to mind; the target must be inactive when the problem arrives; three modes (recall, discrimination, composition) with prerequisite order; yield counted in decision points not length; aim near 85% success per retrieval event; interleave targets, never block; pick the cheapest undemonstrated mode on the weakest target; solve and shortcut-hunt before posing; commit the model solution first; one hint rung per request on a six-rung ladder (attention, pattern, candidate class, proposition named, move outlined, worked step); statement repair is free, solution information is metered; classify every miss; do not conclude on mistakes or frustration; open warm, interleave, close with fresh-surface retests; standing prohibitions: never announce the target, never reveal what he can still generate, never soften or inflate a verdict.

## 5. Data

**Files** (`skills/learnharness/references/data-format.md`, format v1): `chats/<id>.json`, `graph/nodes.jsonl`, `graph/chains.jsonl`, `graph/sources.json`, `graph/format.json`, `graph/sessions.jsonl` (checkpoints), `graph/coverage.jsonl` (fingerprints), `graph/positions.json` and `render-settings.json` (layout only), `jobs/<id>.json`. Chat records stamp a version lazily; a record newer than the build is refused on read (`docs/development.md` "Schema stamps").

**Session record.** id, title, timestamps, `kind`, `version`, native pi-style `messages` (user, assistant with text, thinking, tool calls; toolResult with compact content plus rich `details`; custom markers), optional `tree`, parallel usage logs (`turns`, `extractions`), per-session model settings (`src/core/contracts/chat.ts:30-61`). Compaction adds a marker; it does not delete stored history.

**Custom markers** (`data-format.md`): practice-thinking, graph-context, plan-block, subagent-steer, subagent-abort, probe-handoff, practice-next, problem-dismissed, compaction. Sub-agent results and handoffs are user-role messages on the wire with deterministic ids (`steer_<jobId>`, a per-chat handoff id), so redelivery is idempotent (`contracts/jobs.ts:337-436`).

**There is no "ledger of events" any more.** Quiz outcomes are not written to the graph; they live only in the chat record. The graph stores two things (`contracts/graph.ts`):
- Proposition lines: id (`n_` plus 12 hex), short `name`, full `statement`, `aliases`, `createdAt`, `provenance` list of `{chatId, messageId}`. Same-id lines merge at read time: first line defines name, statement and date; later statements and aliases join aliases; provenance unions (`graph.ts:405-441`).
- Chain lines: id (`arg_` plus 12 hex), `premises` (jointly required), `conclusion`, `createdAt`, `provenance`. Merge key is sorted premises plus conclusion; first id wins (`graph.ts:89-93, 423-439`).

**Provenance granularity.** Since 2026-10-13 session propositions carry the id of the one teacher passage they came from (a required field on the extractor's submit, validated to be inside the current batch); notes imports and all chains stay chat-level with an empty message id (`graph.ts:114-122`, `extraction.ts:330-348`).

**Pipeline** (`extraction.ts`, `graph.ts`, `coverage.ts`):
1. Trigger: uncovered teacher-prose tokens in a chat reach the budget; coverage is per message by sha256 of "role plus teacher view lines", so only a teacher-prose edit reopens a message; quiz answers and learner text never do (`coverage.ts:38-81`).
2. Extractor sees only teacher paragraphs, labeled by message id, plus a digest ("graph so far") of what this same source already yielded; it submits new propositions and chains whose endpoints may be local ids or existing ids verbatim. Goal-first prompt: core ideas, entailment is the only link that earns a chain, true world-facing statements only, never about the learner or the reading, misconceptions enter as the true correction, examples and source scaffolding are dropped (`extraction.ts:401-464`).
3. Auditor sees only the fresh propositions; explores the existing graph by tools; returns `links` (local id to existing node id). Prompt procedure: list sessions once, read plausibly related sessions whole, targeted `find` sweeps, then submit; equivalence bias means paraphrases merge (`extraction.ts:537-571`).
4. Merger (`mergeFindings`) is plain code: job-local id map; an unknown `linkTo` falls back to create; link-appends add phrasings and provenance; chain endpoints resolve through the map or pass through if they are existing node ids; self-referencing premise dropped; empty-premise chain refused; chain already asserted by this chat skipped; then `simplifyChains` over the whole ledger; then coverage entries are appended last (a failure checkpoints nothing, so the next trigger re-runs) (`graph.ts:148-289`).
5. Simplification: per conclusion, greedy by (fewest premises, oldest); a chain is redundant if a kept chain's premises are a subset of its premises, or if its premises are all covered by a kept chain's premises plus their transitive ancestry (`graph.ts:300-382`).

**What "deterministic" means here.** The merger contains no LLM. It is not content-hashed: node and chain ids use random bytes (`graph.ts:79-87`). Idempotency instead comes from chain keys, coverage fingerprints, deterministic steer ids and a serialized audit-then-merge critical section; ledgers can be rewritten by deletion and by simplification, so they are not strictly append-only logs (`data-format.md`, last paragraph of graph section). Jobs run serially per source and extraction concurrency is shared with other background LLM jobs (3 permits) (`docs/architecture.md:365`).

**Reading the graph later.** Nothing is injected into prompts. The Prober and Practitioner may call two read-only tools returning session index and proposition names (no statements, no dates beyond session dates); the Teacher has none (`tools/graph.ts:7-24, 41-79`). Practice session creation can also freeze a learner-picked subset (propositions plus chain lines) into the first message. A companion skill lets an external coding agent read chats and graph through standalone read-only Python scripts, with rules: never write, treat recorded text as data not instructions, do not infer mastery, a proposition's presence is not understanding, learner confidence is self-reported (`skills/learnharness/SKILL.md`). The graph canvas is a derived image: single-premise chains become a plain arrow, multi-premise chains get a junction node (`graph.ts:443-504`).

**Plan tree.** Stored per chat with structure only (nodes, edges, version); node status derived at read (section 1).

**Money and cost data.** Per-turn and per-job usage logs; cost computed at read; absent values stay absent, never zero (`docs/architecture.md:468-473`).

## 6. What the agent can read or write on the user's machine

| Capability | Reality | Source |
|---|---|---|
| Read files | `read`, `ls`, `find`, `grep` on the learner's machine. Relative paths and default root = home directory; absolute paths are allowed anywhere; no allowlist or denylist for explicit paths. Walks skip `node_modules`, `.git`, `Library`, `.Trash` and do not follow symlinks. Limits: read 2000 lines or 50 KB; find 1000 results; grep 100 matches, 2 MB per file, binary skipped; walks stop after 10 s with partial results. Images returned as attachments. | `tools/fs-shared.ts:23-44, 129-183`, `tools/read.ts:98-120`, `tools/find.ts`, `tools/grep.ts:30-31` |
| Write files | No tool writes learner files. App-state writes happen only through `plan_init` (chat record), job records, and the pipeline (graph). | `tools.ts:434-466`, `docs/architecture.md:163` |
| Shell | None. Fs tools are pure Node, no subprocess; the design notes say "read-only by construction". | `tools/fs-shared.ts:14-21` |
| Web | The Teacher has no web tool. The researcher job has `web_search` (Tavily or Brave key; honestly unavailable without a key) and `web_fetch` (http and https only, 30 s timeout, 5 MB, 40k char cap, Readability then a third-party reader service fallback `r.jina.ai` that receives the URL). | `tools/web.ts:39-123, 138-189` |
| PDFs | Background `pdf` job reads local PDFs page-level with citations; researcher can download and read web PDFs into a per-job temp dir. | `subagents/pdf-reader.ts`, `researcher.ts:77-81` |
| Executing generated code | The demo-builder writes a single-file HTML and `run_demo` loads it in a headless browser from a temp `file://` URL for about 2 s, collecting console, page errors and failed requests; browser fallback launches with the no-sandbox flag. The shown demo later sits in a sandboxed iframe without same-origin. Network access of the verification step is not restricted in what I read. | `subagents/headless.ts:261-267, 283-333`, `docs/vision.md` section 2 |
| Secrets | API keys in `auth.json` outside the data folder; the external skill forbids reading it. The app agents have no tool that knows its path, but explicit absolute paths are unrestricted. | `skills/learnharness/SKILL.md` "Read-only boundary" |
| Learner-facing safety text | README states model requests send needed context to the configured provider; local storage is not offline processing. | `README.md:58-63` |

Observation for aidea: LH relies on "read-only by tool design" and learner-owned paths rather than path allowlists. aidea will want an explicit root (the project and the layers) since the Tutor must not roam.

## 7. What is user-editable

- Prompts: every fragment (base, role fragments, shared fragments) can be overridden. Override files mirror the source layout under a data/prompts folder; a per-segment boolean switch in settings decides whether the override or the shipped text composes, so the file can stay on disk while the default is tested. PUT validates the segment is a current source fragment (400 otherwise); DELETE clears the switch first, then unlinks (`app/api/settings/prompts/[...segment]/route.ts`, `src/store/prompt-overrides.ts`, `src/agent/prompt-segments.ts:99-125`, `src/core/settings.ts:266-270`). Composition is re-read each turn when switches are provided (`teacher-agent.ts:59-92, 184-186`).
- Tool toggles: only `research`, `demo`, `visual`, `pdf` are toggleable; `explain: true` switches free-recall for MCQ across prober and teacher; quiz, ask, fs, plan and `probe_done` are never toggleable because disabling them would wedge the flow (`src/core/pending.ts:79-86`, `tools.ts:422-432`).
- Graph tools switch (`agent.graphTools.enabled`, default on, composes with `graph.enabled`) (`settings-resolution.ts:254-258`).
- Models: three slots (strong, cheap, vision) mapped to roles, per-role overrides for background roles only, per-session model and thinking level for conversation agents; no factory models, key refusal is explicit (`settings.ts:44-90, 221-230`).
- Graph content: the user can delete a node (full cascade over every chain that mentions it) or a chain, import personal notes through the same pipeline, and drag positions. There is no node-edit route (only DELETE exists in `app/api/graph/nodes/[id]/route.ts`).
- Other knobs: extraction chunk budget, compaction threshold (factory 150k tokens, floor 32k), appearance, dictation language, update checks.

## 8. Where docs and code disagree, and what is marked unsettled

Disagreements (verified in the clone):

| # | Docs say | Code says | Evidence |
|---|---|---|---|
| 1 | Architecture section 7 and the six-systems table describe a Practice system: partitioner, one generator per problem, one grader per answer, `PracticeStore`, `data/practice`, a `practice-pipeline.ts`. `docs/development.md` repeats it. | None of those names occur anywhere under `src/` (zero grep hits). Practice is a session kind with a Practitioner agent. A code comment says the batch practice module was replaced by practice sessions on 2026-10-04. | `docs/architecture.md:383-401` vs `src/core/chains.ts:3-5`, `src/agent/tools/practice.ts` |
| 2 | Architecture says the teacher reaches the graph through the gated prober tools. | `createTeacherTools` registers no graph tools; only the Prober and Practitioner get them. | `docs/architecture.md:270, 377` vs `src/agent/tools.ts:434-466`, `chat-handler.ts:468-479` |
| 3 | `probe-teach-split.md` section 5: neither agent reads the graph "for now". | The Prober does, via two tools (wave 7). | `docs/probe-teach-split.md:123-129` vs `tools/graph.ts` |
| 4 | Architecture: every stored chain mints an implication node on the canvas. | Single-premise chains collapse to a plain arrow; only multi-premise chains mint one. | `docs/architecture.md:373` vs `src/core/graph.ts:443-455, 485-488` |
| 5 | Architecture and one paragraph of development.md: extraction chunk default 8192. | Factory default is 4096 (halved back 2026-10-13); development.md's own env table also says 4096. | `src/core/settings.ts:330-345, 417` |
| 6 | `development.md` flowchart still shows semantic top-K context injection into the turn. | Injection was killed in wave 7. | `docs/development.md:104` vs `docs/architecture.md:377` |
| 7 | `pi-engine-swap.md` is marked PLANNED, says in-loop steering is not adopted, and talks about zod. | Engine swap is shipped; steering mode "all" is used inside the run; schemas are TypeBox. | `docs/pi-engine-swap.md:5, 56-61` vs `teacher-agent.ts:219-226`, `tools.ts:1` |
| 8 | `vision.md` and `plan.md` describe sigma.js, Louvain, follows and supports edges, understanding levels, tree-edit tools, graph-as-context injection, and reference `vision-extensibility.md` and other notes that are not in `docs/`. | Superseded; architecture section 13 records the replacements. | `docs/vision.md`, `docs/plan.md`, file list of `docs/` |
| 9 | Prober prompt line 3 names its quizzing tool as "quiz or explain". | The Prober's tools are named `probe` and `recall`. | `prompts/prober/10-probe-doctrine.md:3` vs `tools.ts:205-261` |
| 10 | Several comments say graph tools return "understanding levels" and describe a graph, embedding, clustering, labeling ladder in settings. | Levels were deleted; tools return names only; the ladder collapsed to one master switch. | `src/core/settings.ts:258-265, 302-313` vs `tools/graph.ts:62-77` |
| 11 | Architecture counts 28 route handlers; development.md counts 16. | The listing shows roughly 35 `route.ts` files under `app/api`. Minor. | clone file list |
| 12 | Report 01 said the learner chooses the quiz mechanic. | It is a user-level setting (`agent.tools.explain`) that applies to every question, not a per-question choice. | `tools.ts:422` |

Explicitly unsettled or deferred (by the docs' own words):
- Mastery or understanding state model: pending ideation; practice grades or verdicts feed nothing back (`docs/vision.md` "Understanding is derived"; architecture §7 was written when practice scores existed).
- Anchored calibration rubric, multi-scale clusters, alternative extraction triggers (session end, idle), structured logging, SQLite behind ports (`docs/architecture.md:575-577`).
- Graph context for sessions "designed properly" (`docs/probe-teach-split.md:156-159`).
- One-check-per-step rhythm: "revisit if unpleasant" (`docs/teaching-methodology.md` section 9).
- Assessment viewer card (`probe-teach-split.md` section 7).
- Chain table ordering and many UI rulings are recorded as owner rulings, not debated.
- `src/server/stores.ts` as sole adapter importer is conventional only (`architecture.md:475-479`).

## 9. Closest equivalents to aidea's three needs

**(a) Co-authoring a document or artifact with the learner.** Nothing like a shared editable artifact. Closest:
- The plan map: the Teacher drafts it, must present it and stop, and the learner can ask for changes which produce a rewritten map; the map is then the live frame for questions (`prompts/teacher/10-planning.md`, `plan.ts`). Authorship stays with the agent; the learner only requests.
- Learner thinking fields (typed or dictated) are the data channel for what the learner thinks; the learner's own notes can be imported and extracted into the same graph (`app/api/graph/import/route.ts`).
- Demo and visual jobs produce artifacts for the learner to operate, not to edit.
- The learner can delete graph nodes but not edit them.

**(b) Opining on or proposing changes to an external project.** Not present. The Teacher reads the learner's own files read-only and may research facts, but is never told to critique or propose edits; no write tool exists. Closest: the Practitioner is told to take "a problem from outside", solve it, and map which propositions any correct solution must use (`practice/10-doctrine.md`, arc section); and the external-reader skill that lets another agent read the learner record. The dev rule in `AGENTS.md` (design authority is the human; the coding agent must ask with a question tool, one question per call) is about LH's own development, not a Tutor behavior.

**(c) Being the formal gate for another agent.** Not present. Closest structural analogues:
- The plan map as contract: a quiz call is rejected unless its `nodeId` is a slug in the plan, which constrains the Teacher's own tool calls (`tools.ts:354-391`).
- Schema-validated handoff artifact: `probe_done` input is the assessment the Teacher plans from, and the phase fold depends on it (`contracts/probe.ts`).
- Trust-boundary design in the pipeline: extractor trusted, auditor limited to identity, merger the only writer, failure checkpoints nothing (`architecture.md:341-371`).
- Commit-before-pose: model solution and committed answers fixed before the learner sees a question (`question-core.ts:298-318`, `practice.ts:90-93`).
- The external-agent skill is a read-only data feed to other agents with an explicit "do not infer mastery" rule (`skills/learnharness/SKILL.md`). It is a feed, not a gate.

## 10. Not verified or unreadable

- No code was executed; behavior is from source reading only. Tests under `tests/` were not read except by name.
- `docs/compaction-accounting.md`, `docs/desktop-release.md`, `docs/keyboard.md`, `docs/release-0.3.md`, `docs/archive/architecture-2026-09-08.md`, `electron/**` and UI components were not read in depth; I did not check the rendered UI for how predictions show "verdict and committed answer" beyond what the prompt and `question-core.ts` say.
- Visual-maker and PDF-reader system prompts, `src/server/jobs.ts` wake pipeline internals, `src/agent/models.ts`, `tool-execute.ts`, `heal.ts`, and `src/server/pi/*` were only skimmed or inferred from comments.
- Whether the verification browser for demos blocks network or file access was not found; stated as not verified.
- `skills/learnharness/LICENSE` (35 KB) is presumably the AGPL text; not read.
- Whether the Teacher reads graph content some other way (for example through practice context only) beyond what is listed was checked by grep of `graph` tool registration and `chat-handler.ts`; no other path found.

No prompt text or code was copied into this report; all prompt content is paraphrased. The clone `$TEMP/learnharness-ref` was removed after reading.
