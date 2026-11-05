# 03: The optional leftovers of the code review of 2026-11-04

**What to build:** `.scratch/code-review-2026-11-04.md` lists what was left on purpose: a shared `make` helper, a `chatUi.send` seam, a test that the 2000 and 8000 limits match, splitting the secret detector out of `54-select.js`, and the `chat.ts` allowedTools list. Do them, one commit each, each behaviour-preserving.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser)

- [x] The shared `make` helper replaces its copies, with the existing tests unchanged.
- [x] `chatUi.send` is the one way to send a message from other features.
- [x] A test proves the 2000 and 8000 character limits of the interface and the core are the same number.
- [x] The secret detector lives in its own file and `54-select.js` uses it.
- [x] The allowedTools list of `chat.ts` has one source; `npm run verify` is green.

Source: `.scratch/code-review-2026-11-04.md`, section "Left from the judgement calls".

## What was built (2026-11-05)

- One commit for the two of the core side and one for the interface (all behaviour-preserving):
  - `test/select-limits.test.ts` fails when the interface's selection limits (`54-select.js`) differ from the core's (`select.ts`).
  - `routes/mcp.ts` exports `BUILDER_TOOLS` (its tools but `approve`); `routes/chat.ts` allows exactly those plus the tools plugins offer: one source for the list.
  - `uiMake` in `00-canvas.js` is the one helper that builds an element; `01-dialog.js`, `46-layer-class.js`, `52-plan.js`, `53-drift.js` and `03-plugin-manager.js` (`pmEl`) use it instead of their own copies. `run/ui.js` keeps its own: a plugin cannot use the kernel's globals.
  - `window.chatUi.send(text)` is the way to send a message from another feature; the Run plugin's "Ask the Builder to review the recipe" uses it instead of reaching into `#chat-input`.
  - The secret detector is `54-secret-check.js`; `54-select.js` calls it.
- Left as the review said (not asked for here): `source: "terminal"` stays a bare string until a second source exists; the Electron close handler stays without an automated test.
- Verify: 1025 pass, 0 fail. Live (main monitor, the person's browser, `serve-run-failure.mjs`): after a failed Play, "Ask the Builder to review the recipe" put the message in the chat through `chatUi.send`; `uiMake`, `pmEl`, `chatUi.send` and the detector are present; no page errors.
