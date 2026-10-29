# 09: "Teach me through it" led by the Tutor on all five layers

**What to build:** The "Teach me through it" button of each diagram layer (Business exists as a fixed quick tour) starts a layer class led by the Tutor: Probe if not done, the layer's part of the Plan, teach loop, and co-authoring of the layer's elements. While the Tutor is unavailable (not signed in, no adapter, failed) the button runs the fixed quick tour. Every layer gets its own teaching content in one structure per layer, in the shape already used for Business (what it is, the guiding question, an example, the order of its elements, what to ask), written in plain words: Requirements (functional and non-functional, criteria), Architecture (kinds, containment, relationships), Components (packages, classes, relationships and Resolution) and Algorithms (flowchart symbols, decisions, loops) join Business. The layer cards show the button on all five layers.

**Blocked by:** 07, 08

**Status:** done

- [x] Each of the five diagram layers has the button and a content structure with hints, a short description, a question and an example per element kind; wording is plain and free of jargon.
- [x] With the Tutor available the button starts a layer class; without it, the fixed quick tour runs and says that the Tutor is not available.
- [x] The layer class ends with the pipeline of ticket 04 and leaves the layer's pending Proposals visible.
- [x] Verified with a headless browser: screenshots of the button on each layer, a quick tour step on a non-Business layer, and the unavailable message.
- [~] Read by the person for clarity (last box, for the person).

## Review notes

- [x] `test/layer-class.test.ts` (5 tests) written first and run RED (5 of 5 failed), then green; 358 tests, 357 pass, 1 skipped; typecheck clean.
- [x] Content: `src/core/layer-help.ts` holds one structure per layer (name, what, guiding question, example, order, elements with hint, what, question, example, narration) for Business, Requirements, Architecture, Components, Algorithms; `GET /layers/help` serves it. The Business entries repeat `46-business-help.js` and a test fails if they drift. A test also rejects a short list of jargon words in all the text.
- [x] `POST /tutor/classes {project, layer}` builds the first message from the layer content (`layerClassMessage`): get_plan and set_plan for the layer's concepts, begin_step with `item`, and for Business/Requirements/Architecture the co-authoring order; for Components/Algorithms it says the layer is drawn from the code and makes no proposals. Unknown layer (or `code`) is a 400 naming the five layers. The end-of-class pipeline and the Proposals are the existing ones.
- [x] UI `src/ui/features/46-layer-class.js` turns Business's opener into the button of all five layers (Code has none): the Probe runs first if the layer was never checked, then the class. If the Tutor cannot be reached before it says anything (not installed, not signed in, failed), `startClass` returns true (`opts.fallback`) and the quick tour runs with the line "The Tutor is not available, so this is the quick tour."; Business falls back to its own dimming tour. The tour of the other four layers is a panel over the layer's content (introduction, then each element, Back/Next/Close, Escape).
- [x] Headless Chrome with a scripted adapter (no real model): button visible on the five layers, a layer class on Requirements streams the Tutor's text, with the Tutor "not signed in" the Algorithms layer shows the quick tour and the note, and Business shows its own tour and the note; no console errors beyond the pre-existing favicon 404. Screenshots deleted.
- NOT done: the last box (the person reads the content for clarity); the real Claude Code was not run, so how a layer class feels is unchecked; the Algorithms button exists only once a function is opened (its tab is disabled before that, as before); a Probe that ends without a result (Prober unavailable) shows its error, then the class tries and falls back to the quick tour.

## Live run with the real Claude Code (Electron on the second monitor, haiku)

- A layer class on Requirements did NOT co-author: the Teacher read the Plan, found requirement concepts already in it and gave a lecture (`begin_step`, `predict`, `explain`), never asking an element question and making no Proposal. Cause: the first message told it to work the Plan first and "then" build the layer with the person.
- Fixed: for the layers the person writes, the message now says this is a co-authoring class, not a lecture, and that the FIRST question is the first element, asked with `ask {element}` before any Plan work (the element tag is given). Re-run live: element question, `propose_node` quoting the person's words (`save-cart`), "Other ways to see this", next element; accepted in the interface it drew the Node and updated the Contract card. Test in `test/layer-class.test.ts`.

`[~]` = closed as done without this check being recorded at the time; not re-verified (cleaned up on 2026-10-30, history in git).
