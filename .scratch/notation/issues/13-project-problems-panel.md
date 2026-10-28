# 13: Problems in a project's files get their own panel

**What to build:** When a file of the authored layers (`.aidea/*.json`) has data the core cannot accept, the core already drops the bad item and reports a message. Today those messages are painted as red text at the top of the Canvas, over the drawing, on every layer (seen in the real desktop window: six red lines covering the package of the Components layer while the problem was in Requirements; a relation to a missing node reads as a raw file message). Give them a proper home. A layer tab shows a small red count badge when that layer's file has problems. A "Problems (N)" button appears next to the "?" button of the Canvas card only when the open Project has problems; it opens a popover (closed by default, closes with Escape and an outside click, inside the Canvas in narrow windows) listing the problems grouped by layer, each in plain words that say which item (its id or title when known, otherwise its position), what is wrong and that the item was ignored, for example: `Requirements: item "login" was ignored: it needs a non-empty "statement"`, with the file name (`.aidea/requirements.json`) in small text. Problems of a layer are never drawn over the Canvas; the badge and the popover are the only places. The legend does not change. When a file has no problems nothing appears. Proposals that would produce an invalid item keep being refused with their message in the chat as today.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Through the core protocol: the authored-layer response lets the interface group problems by layer and name the item (id when present) without parsing free text; existing `errors` text keeps working for other consumers; all earlier authored-layer and proposal tests pass.
- [ ] No red text is drawn over the Canvas on any layer; a layer with problems shows a count badge on its tab; the "Problems (N)" button exists only when N is greater than 0.
- [ ] The popover lists every problem, grouped by layer, in plain words with the item named and the file in small text; it is keyboard operable (button name, focus return, Escape closes) and not clipped at 420 px wide.
- [ ] Verified headless (no visible window) at 1440x900 and 1000x700 on the `studio-requirements` fixture (six problems on the requirements layer) and on a copy of `studio-c4` whose architecture has a relation to the missing id "ghost": screenshots read by the implementer; no console errors; Proposals and the legend still work.

## Review notes

- [x] Core: `GET /authored` now also returns a top-level `problems` list (`layer`, `file`, `id` when present else `index`, `field` when known, plain `message` ending with what was ignored); `errors` strings are untouched. `test/problems.test.ts` was written failing first; `authored`, `architecture-data` and `requirements-kinds` tests pass unchanged.
- [x] No red text over the Canvas (the `#authored-errors` element and its CSS are gone); red count badge on the tab of a faulty layer; "Problems (N)" button only when N > 0 (`src/ui/features/49-problems.js`).
- [x] Popover: grouped by layer, item named by id (or position), file in small text; button name, Escape closes and returns focus, outside click closes, opening the legend closes it. Checked headless at 1440x900, 1000x700 and 420x800: not clipped.
- [x] Headless run on `studio-requirements` (6 problems, tab badge 6, shown from Components and Requirements) and on a copy of `studio-c4` with a relation to "ghost" (1 problem on Architecture); a clean project shows no button and no badge; no console errors; legend still opens.
- [ ] Proposals refusing an invalid item in the chat was not re-run in the browser (core tests cover it).
- Note: `markTabs` in 70-proposals.js rewrites a tab's text, so it calls `problemsMarkTab` to restore the red badge.
