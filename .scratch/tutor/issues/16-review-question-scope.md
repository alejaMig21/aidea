# 16: The review question only opens a free class, and prefers ideas taught in this Project

> Note (2026-11-04): Class mode, Direct mode and the decision classes were removed in commit 58d676d. Read what follows as history of how the Tutor was built, not as how it works now.


**What to build:** Ticket 15 put one review question at the start of every class. A live run with the real Teacher showed two problems: the question came before classes the person had asked for on purpose (a class on selected text, on a difference from the Contract, on a layer), where it felt like a toll booth; and it was chosen only by how long ago it was last reviewed, so it could be about another Project entirely (a Python list, in a Project about quotes). Change it in two ways, decided with the person:

1. **Only a free class has it.** A free class is the one started with "Start a class" (with or without a topic written in the box). A class on selected text, a class on a difference, a layer class and a decision class never have a review question.
2. **It prefers ideas taught in this Project.** The idea is chosen among the ideas that came from classes of this Project (the one reviewed longest ago first). Only when the Project has none (a blank Project, or one with no class yet) does it fall back to every idea the person has, with the same rule as before. An idea says which Project it came from when it is saved; ideas saved before this change take the Project from the Evidence of the class they came from, and an idea whose class left no Evidence counts as having no known Project (it belongs to the fallback only).

Everything else of ticket 15 stays: the core chooses the idea, never one the class is about to teach, the answer is Evidence and does not change the graph, "I don't know" is always allowed, the person can turn it off and the choice is remembered.

**Blocked by:** None (ticket 15 is done).

**Status:** done

- [x] Through the protocol with a scripted Teacher: a free class (with and without a topic) gets the review question when the graph has an eligible idea; a class on selected text, on a difference, on a layer and a decision class do not, and the Teacher's `review` tool answers that none is due.
- [x] A Project with ideas of its own reviews one of them even when another Project's idea is older or was never reviewed; a Project with none falls back to the rest of the ideas; an idea whose Project is unknown is used only in the fallback.
- [x] A new idea saved by the pipeline records the Project of its class; an idea saved before this change counts for the Project that has Evidence of its class.
- [x] The idea is still never one the class is about to teach, and the rotation (longest ago first, per Project) still holds.
- [x] Verified live with the real Claude Code on the second monitor: a free class in a Project with its own ideas reviews one of them; a class on selected text starts without a review.
- [x] `GLOSSARY.md` (Review question) says this.

## Review notes

- [x] `test/review-question.test.ts` (15 tests) written first and run RED (6 of 15 failed or hung), then green; 402 tests, 401 pass, 1 skipped; typecheck clean. One existing test (`learner-graph`) now expects the Project in the provenance of a new idea.
- [x] `src/core/routes/tutor.ts`: the review is added only to a free class (not held, no layer, no difference, no selection). `src/core/review.ts` (`pickReview`): among the ideas of this Project (the idea says so in its provenance, or it was saved before that and the Evidence of its class belongs to this Project) the one reviewed longest ago; when the Project has none, among every eligible idea. The topic of a free class (the text box) still excludes ideas it names, by name or alias. `Provenance` gains `project`, set by `mergeGraph` from the class the pipeline closes.
- [x] Verified live with the real Claude Code (Electron on the second monitor, haiku): a free class in a Project with ideas of its own opened with a review about its cart (those ideas were saved before the change, so this exercised the Evidence path); a free class in another Project opened with a review about that Project's architecture; a class on selected text went straight to its first step with no review.
- [x] Code-review (Standards: no hard violations; Spec: one real gap) fixed in a second commit: a Project that has ideas of its own, all ruled out by the topic, now gets no review instead of one about another Project (test RED first, then green); `pickReview` reads the Project's Evidence once and its comment says only the topic is used; the GLOSSARY entry says what a free class is and that the topic excludes ideas; a stale comment in `learner.ts`.
- NOT done: ideas saved before this change whose class left no Evidence count as having no Project (only in the fallback); "of this Project" is where the idea was taught, not how relevant it is to the Project's code; the near-duplicate ideas and code-like idea names seen in the live run are not touched here.
