# 02: The Tutor teaches how to ask a Builder well

**What to build:** A lesson, taught with the teach loop: how to ask a Builder for work in its chat (a goal in plain words, the context it rests on, constraints, how the person will know it is done). The person writes first, in the Builder's chat or in a practice problem; the Tutor checks what they wrote and says what is missing. The Tutor never writes or sends the request for them.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser)

- [x] The person writes a request in the guide class (a text question, or a practice problem); the Tutor reads it and names what is missing.
- [x] The Tutor has no way to put text in a Builder's chat.
- [x] The lesson says how to point a Builder to the Contract.
- [x] Core API tests pass; `npm run verify` is green.

Source: `.scratch/roles-and-contract/spec.md` and ADR 0010.

## What was built (2026-11-05)

- `guide.ts`: a new part "Asking the Builder well" right after "The Builder" (in the Tutor's guide class and in the quick tour): the four things a request holds (the goal, what it rests on, the limits, how you will know it is done), the menu "Add a reference to the message", that nothing else starts the Builder, and that for a bigger piece the person can ask it to read the Contract and start with the first task. Every label in quotes is one the interface shows (the guide test keeps it so).
- The opening message of the guide class: for this part the person writes first (a text question: the request they would send to the builder), the Tutor reads it, says which of the four things is missing and why it matters, lets them rewrite it, and never writes the request for them or offers to send it. The Tutor has no tool that puts text in a Builder's chat (pinned in `test/builder-asked-in-chat.test.ts`).
- Tests: `test/guide-asking.test.ts` (3): the part and its place, the instruction, and that the person's request reaches the Tutor as written. Live (main monitor, the person's browser): the quick tour now has 11 steps with "Step 4 of 11: Asking the Builder well" after "The Builder"; no page errors. The class with the real Tutor was not run (quota).
- Note: this part belongs to the kernel trunk of the guide; plugin-lessons 05 decides which parts of the guide stay in the kernel.
