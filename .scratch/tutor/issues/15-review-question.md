# 15: One review question at the start of a class (optional)

**What to build:** At the start of a class the Tutor asks one question about an idea from an earlier class, without hints, chosen from the Learner graph (never the idea it is about to teach). The answer is Evidence. The person can turn this off. This ticket may be dropped.

**Blocked by:** 04, 05

**Status:** done

- [x] Through the protocol with a scripted Teacher: a class starts with one review question about a Proposition from a previous class when one exists, and with none when the graph is empty.
- [x] The review answer is Evidence and does not change the graph.
- [x] The person can turn it off and the choice is remembered.

## Review notes

- [x] `test/review-question.test.ts` (6 tests, through the protocol with a scripted Teacher) written first and run RED (6 of 6), then green; 380 tests, 379 pass, 1 skipped; typecheck clean. Four tool-list assertions now include `review`.
- [x] `src/core/review.ts`: the core, not the model, chooses the idea: from the Learner graph, never one that overlaps the class topic or the selected text, the one reviewed longest ago (never reviewed first; graph order breaks ties, so it is the same every time). `POST /tutor/classes` appends the instruction to the first message; a short decision class never has a review; an empty graph (or only the idea being taught) has none.
- [x] New Teacher tool `review` (same arguments as `ask`, no stepId): refused when no review is due or it was already asked. `begin_step` is refused until the review was answered ("I don't know" counts). A choice is graded by the program, a text answer by the grader. The answer is Evidence with `phase: "review"` and the idea; the graph is untouched (tested: the graph is the same before and after, the review is not in the class prose the pipeline reads).
- [x] The person can turn it off: `POST /agent-options {reviewQuestion: false}` (400 for a non-boolean), stored per Project in the preferences file, returned by `GET /agent-options`, survives a core restart (tested). UI: a checkbox in the Tutor column ("Start a class with one review question about an earlier idea"), and the question card is labelled "Review of an earlier class".
- [x] Verified in headless Chrome (no window, so nothing on any monitor) with a scripted Teacher: the review card appears first with its label, answering lets the class go on, unchecking survives a reload and the next class has no review; no console errors.
- NOT done: a review answered wrongly does not feed anything back into the Plan or the graph (by design here); the person cannot choose which idea is reviewed; quality of the questions the real Teacher writes was not checked with Claude Code.
