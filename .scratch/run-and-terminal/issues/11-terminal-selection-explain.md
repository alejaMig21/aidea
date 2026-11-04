# 11: Select text in the terminal and ask the Tutor to explain it

**What to build:** Selecting text in a terminal tab shows the selection control with "Explain" and "Enter the Tutor". Terminal text has its own limit of 8000 characters; a longer selection keeps its END and the control tells the person it was cut. The rest of the app keeps its limit of 2000. Neither the Tutor nor the Builder reads the terminal on its own: text travels only when the person presses a button, and only as data, never as an instruction. See `.scratch/run-and-terminal/spec.md` (stories 42, 43, 46, 47, 50 and 52).

**Blocked by:** 02, 05.

**Status:** done, checked live in Electron on the second monitor (2026-11-04)

- [x] Selecting text in a tab shows the control with the two buttons; selecting elsewhere keeps the 2000 character limit.
- [x] A terminal selection of 8000 characters or fewer is sent whole; a longer one is sent as its last 8000 characters and the control says so.
- [x] "Explain" returns a brief explanation from the Tutor; "Enter the Tutor" starts a class on the text.
- [x] Text that looks like an instruction ("ignore your rules...") is treated as data (a test with such text).
- [x] Nothing from the terminal reaches the Tutor or the Builder unless a button is pressed.
- [x] Core API tests and page tests pass (test/select-text.test.ts, test/terminal-select-page.test.ts).
- [x] Verified live on the second monitor. (live: real mouse selection of 15915 chars says the start was cut (shots/11-12-terminal-selection.png); Explain and Enter the Tutor not pressed (they call the real model))
