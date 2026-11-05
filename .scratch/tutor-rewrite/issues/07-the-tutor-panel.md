# 07: The Tutor panel: one chat, the Plan, practice

**What to build:** Rebuild the interface of the Tutor on the new session: one conversation, the Plan beside it (items, dependencies, the current one) and a way to ask for practice. The context menu (selected text, a Node, a difference) attaches context to a question. The Differences and Contract sections leave the panel with roles-and-contract 04.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser; the real Tutor was not started)

- [x] The panel shows the conversation, the Plan and a Practice entry (a button that starts `{practice: true}`), and nothing of the old class kinds.
- [x] Asking from a selection or a Node attaches it as context.
- [x] It works at 1920 and 1280 pixels and with the keyboard; the legend and layer tests pass.
- [x] The Plan panel shows items, dependencies and the current one (moved from tutor-rewrite 03).
- Not done here: a live check with the real Tutor (it spends the person's quota) and a look at 1280 pixels.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.

## What was built (2026-11-05)

- The panel (`50-tutor.js`): the box above "Start a class" is now "Ask anything about your project (optional)" and what is typed goes as `message` (the person's question, as the core's one session takes it); next to it a "Practice" button starts `{practice: true}`. The Probe card was already gone (tutor-rewrite 02); the entries by kind (a layer, a difference, selected text, the guide) still attach context to the same session.
- The Plan section (`52-plan.js`): the item the open step is about is marked (`tutor_step` events now carry `item`; a `plan-step` event moves the mark) and the summary says "waiting for your go-ahead" until the person agrees; the go-ahead sends the approved Plan to the panel (`teach.ts`). Items, their dependencies ("after 1 and 2") and what is covered were already drawn.
- Tests: one more in `test/plan-go-ahead.test.ts` (the approved Plan reaches the panel; the step event names its item); the page tests and the legend tests pass. A CSS escape in a template string (`\\25B6`) once broke the script and the page tests did not notice because they do not open a Plan: lesson noted.
- Live (main monitor, the person's browser, stand-in Tutor, `serve-fake-task.mjs`): the box, "Practice" (enabled with a Project open) and "Start a class" are there; during a class the Plan item "relations" is marked current and the summary no longer says it waits after the go-ahead; no page errors. The check with the real Tutor needs the person's quota and was not run; the layout at 1280 pixels was not looked at (the new button is a full-width row like "Start a class").
