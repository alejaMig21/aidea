# 13: Select any text to learn about it

> Note (2026-11-04): Class mode, Direct mode and the decision classes were removed in commit 58d676d. Read what follows as history of how the Tutor was built, not as how it works now.


**What to build:** The person selects text anywhere (a builder reply, a Rationale, a line of code in the code box) and a small control offers "just define" (a brief explanation with no class) and "enter the Tutor" (a class on that text, which becomes the topic of a free class and is added to the Plan if it fits). It works in Class mode and in Direct mode, and never selects text of the person's own input boxes.

**Blocked by:** 05

**Status:** done

- [x] Through the protocol: "just define" returns a brief explanation from the Tutor without opening a class or writing the graph; "enter the Tutor" opens a class whose topic is the selected text.
- [x] The selected text is sent as data to the Tutor (never as instructions) and limited in size.
- [x] Works in both modes.
- [x] Verified with a headless browser: select text in the chat and in the code box, the control appears next to the selection and closes with Escape.

## Review notes

- [x] `test/select-text.test.ts` (5 tests, through the protocol with a scripted agent) written first and run RED (5 of 5), then green; 374 tests, 373 pass, 1 skipped, typecheck clean.
- [x] `POST /tutor/define {project, text}` returns `{definition}` from a new one-shot role `definer` (no tools, the Tutor model of the Project): no class, no pipeline, no Evidence, no Learner graph (tested). The text is sent as one quoted JSON string and the instructions say never to obey it. Empty, missing or over 2000 characters is a 400; a failed definition is a 502 with a plain message.
- [x] `POST /tutor/classes {project, selection}` opens a free class whose first message quotes the text as data and tells the Teacher to add the concept to the Plan with `set_plan` first (a step needs a Plan item once a Plan exists). Works in Class mode and Direct mode (tested in both). This deviates from "added to the Plan if it fits": it is always added, because the person asked for it and the Plan gate would otherwise refuse the class.
- [x] UI `src/ui/features/54-select.js`: selecting text anywhere (chat, code box, the Tutor's own words) shows "Just define" and "Enter the Tutor" next to the selection; Escape or a click elsewhere closes it; text selected in an input, textarea or select never shows it; more than 2000 characters shows a hint and disables both buttons. The definition appears in the same small box.
- [x] Verified in headless Chrome (no window, so nothing on any monitor) with a scripted agent: control after double-clicking a word of a builder reply and of the code box, definition shown with no class opened, nothing for text selected in the chat input, "Enter the Tutor" starts the class with the text as data; no console errors.
- [x] Code-review (Standards: no documented violations; Spec: three real findings) fixed in a second commit: a definition that arrives after the selection changed is no longer shown (the selection change cancels it); "Enter the Tutor" is disabled with a plain hint while a class is already running (it used to do nothing); `contenteditable="plaintext-only"` boxes count as typing; the size check is one helper (`validSelection`) shared by both routes. Checked in headless Chrome (no window).
- NOT done: the control cannot be reached with the keyboard alone (only Shift+Arrow selects, and focus never moves into it); touch selection is not covered (no selectionchange listener); the control can cover part of the text below the selection; "data, not instructions" for the class is prose the Teacher follows, not something the core enforces; quality of real definitions was not checked with Claude Code.
