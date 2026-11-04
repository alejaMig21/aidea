# Code review of 6757c86...HEAD (state saved before a PC restart, 2026-11-04)

Fixed point: `6757c86`. HEAD when saved: `f3f0cbe` (plus this file). Both reviewers (Standards, Spec) finished; nothing is running. Nothing below is fixed yet. Verify at this point: 873 tests, 0 failing.

## Decide first (the person's call)

1. Where does a button "Ask the Builder to review the recipe" go when a valid recipe exists? Today only no-recipe / invalid-recipe shows "Ask the Builder for a recipe" in the top bar (story 4, ticket 10 box 4 is met at the API and by typing in the chat).
2. Is the log-line change for a silent program enough as a normal permission card the person can refuse (today), or does it need its own Proposal object (story 17)?

## To fix (agreed as valid, in this order)

Spec axis
- `src/plugins/run/main.js` `signalProblem`: a port such as 80 passes a file that only says 8080. Match the port as a whole number (`(?<![0-9])80(?![0-9])`). A `url` signal with no port uses the pathname, so almost any file shows "/": require the host or port instead. Add tests for both.
- Consent dialog (`src/plugins/run/ui.js`, the `lines` of `ui.confirm`) shows only `name: command`. Story 8 wants the whole recipe: also folder, waitFor, env variable names and ready signal.
- `electron/main.js` `restart-app` stops running parts without asking. Ask the same question as on close ("Stop and restart / Keep aidea open") when parts are running.
- `electron/main.js` close handler: if `callRun("running")` fails it returns `{}` and the window closes with parts possibly still running. Decide: treat a failed answer as "unknown" and ask.

Standards axis
- `src/ui/features/03-plugin-manager.js`: `.pm-source` uses 11.5px, not on the scale. Use 12px and add a row in `docs/agents/ui-style.md` for the source line.
- `.scratch/dlg.cjs`: a throwaway edit script was committed by mistake. Delete it (check `git ls-files .scratch | rg "\.cjs"` for others).
- `src/plugins/run/ui.js` `recipeCard`: inline `style="display:flex;gap:8px"`. Use a class.
- `03-plugin-manager.js` `pmInstalledRow`: the nested ternary for the state badge twice repeats `failed || incompatible`. Use a small map state -> { text, kind }.
- `electron/main.js`: merge `if (url) coreUrl = url; if (url) openWindow(url);`.

## Judgement calls to consider (smaller, optional)

- `make(tag, props, ...kids)` exists three times (`01-dialog.js`, `run/ui.js`, `pmEl`). A plugin cannot use the kernel's global helpers, so only the kernel pair could share one.
- `run/ui.js` reaches into `#chat-log`, `#chat-input` and `.proposal-line` by id. A seam like `window.chatUi.send(text)` and a card slot would be cleaner (compare `chatUi.fix`).
- The selection limits (2000 and 8000) are repeated in `src/core/select.ts` and `54-select.js` and kept equal by a comment. A test that fails when they differ, or a value the core serves, would remove the risk.
- `source: "terminal"` is a bare string with one value; leave it until a second source exists.
- `54-select.js` now holds the control, the secret detector and the warning. The detector is pure and could be its own file.
- `chat.ts` `allowedTools` is a hand-kept list that keeps growing.

## Noted, not changing

- The Builder's recipe tool and the "Ask the Builder" button submit text to the chat on one click: it is an explicit action; keep.
- The guard now skips `.aidea/run.json` entirely: the consent hash protects it (test in `test/authored-guard.test.ts`). The spec said the guard must "learn the new file"; this is how.
- Ticket 14 items not built (detail view, gear icon, a menu for Remove, a real focus trap): already written in the ticket header.
- Ticket 09: the Electron close handler has no automated test, only the live script (scratchpad `live19/close.mjs`). Extracting it into a testable function is optional.

## Still open from the handoff (not started)

- Authored-layer guard (`src/core/guard.ts`) not moved onto the plugin guard mechanism.
- Older v1 tickets: layout-and-data 09, 10, 11, 05, 14, 15, 17; remove Class/Direct (`decision-class.ts`); stale headers of `v1-gaps/01` and `03`.
- Live check of ticket 10 with a real Builder, and of Explain / Fix / Explain and fix with the real models (not pressed so far).
