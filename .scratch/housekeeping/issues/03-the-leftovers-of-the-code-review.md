# 03: The optional leftovers of the code review of 2026-11-04

**What to build:** `.scratch/code-review-2026-11-04.md` lists what was left on purpose: a shared `make` helper, a `chatUi.send` seam, a test that the 2000 and 8000 limits match, splitting the secret detector out of `54-select.js`, and the `chat.ts` allowedTools list. Do them, one commit each, each behaviour-preserving.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The shared `make` helper replaces its copies, with the existing tests unchanged.
- [ ] `chatUi.send` is the one way to send a message from other features.
- [ ] A test proves the 2000 and 8000 character limits of the interface and the core are the same number.
- [ ] The secret detector lives in its own file and `54-select.js` uses it.
- [ ] The allowedTools list of `chat.ts` has one source; `npm run verify` is green.

Source: `.scratch/code-review-2026-11-04.md`, section "Left from the judgement calls".
