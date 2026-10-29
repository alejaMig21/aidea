# 08: Co-authoring: the person's words first, then a Proposal

**What to build:** In a layer class the Tutor asks, in plain words, what an element of the layer is (for example who the business is for), lets the person answer in their own words, and turns the answer into a Proposal through a Tutor tool (same Proposal mechanism and same validation as the builder's, so it appears pending and the person confirms). Only after the person has answered may the Tutor offer alternatives, as a question. The Tutor cannot create a Proposal before asking the question it belongs to. Proposals made by the Tutor are marked as coming from the Tutor.

**Blocked by:** 03, 05

**Status:** done

- [~] Through the protocol with a scripted Tutor: a Proposal tool call is refused if no question about that element was answered first; after an answer it creates a pending Proposal validated by the same rules as the builder's (bad fields refused with the same messages).
- [~] Accepting or rejecting works as for the builder's Proposals; the Proposal says it came from the Tutor.
- [~] The Tutor has no way to change a Node except by a Proposal.
- [~] The answer text is stored as Evidence and the accepted Node's Rationale can cite it.
- [~] Verified with a headless browser: a Tutor Proposal appears with the dashed pending style on its layer.

## Review notes

- [x] `test/co-authoring.test.ts` (6 tests, through the HTTP protocol with a scripted Tutor) was written first and RUN RED: all 6 failed against the old core (tools unknown). Then implemented; 6 pass. `npm run typecheck` passes.
- [x] Tools: `propose_node {layer,node,element,because?}` and `propose_change {layer,id,changes,element}` (in `TUTOR_TOOLS`, defined in new `src/core/tutor-authoring.ts`). They call the builder's `propose()` itself, so every validation message is the builder's (tested: missing block, bad layer, non-object node, duplicate id, unknown Node, id change, empty changes). `NODE_HELP` moved from `routes/mcp.ts` to `tutor-authoring.ts` and is imported back.
- [x] `ask` takes an optional `element` tag. With it: kind must be "text" (else error), no stepId and no step loop, no grading; the answer is recorded as Evidence and, if it has words, the element becomes "answered" for the class (state in `lesson.elements`). A "don't know" does not open it. `stepId` is no longer `required` in the schema (the loop still refuses a check without one).
- [x] Refusal text: `Ask the person about <element> first and wait for the answer: call ask with element "<element>", then propose.` Also refused: no element (`element must be a short text...`), or an element tag never asked about.
- [x] A Tutor Proposal carries `source {role:"tutor", classId, questionId}`, `fromAnswer` (the person's words) and optional `because`; the secret stays out of GET /proposals. Accept and reject use the unchanged `/proposals/answer` (tested for accept of a change, reject of an add). The Rationale can cite the answer: the tool descriptions and the instructions tell the Tutor to quote it in `why` (the Tutor writes it; the core does not rewrite it, tested with a Node whose `why` quotes it).
- [x] The Tutor has no other way to change a Node: tool list asserted in 4 test files (`propose_node`, `propose_change` after `finish_class`); the old "no tool named propose" check in `tutor-reads.test.ts` now exempts exactly these two.
- [x] Instructions: new layer-class paragraph (ask with element, own words, Proposal, only then "Other ways to see this"); total under 4000 characters (asserted).
- [x] UI: Tutor stream draws a "From the Tutor: proposal to add/change ..." line with Review; the builder chat line is prefixed "From the Tutor." when `source` is set; the proposal box shows a "From the Tutor" pill and the person's quoted words. Pending dashed style unchanged. Verified headless Chrome (scripted adapter): one `.proposal` on the Business layer with computed `stroke-dasharray: 5px, 4px`, the label, the quote in the box, no console errors. Screenshots and the script deleted.
- Not done: the quoted answer is not auto-inserted into `why`; follow-up alternatives have no enforcement (as specified); an element question cannot be a choice question.

`[~]` = closed as done without this check being recorded at the time; not re-verified (cleaned up on 2026-10-30, history in git).
