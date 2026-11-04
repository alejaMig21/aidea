# 08: Opening a module with a double click also offers "Just define / Enter the Tutor"

**What to build:** In a live run on the second monitor, double clicking a module box in the Components overview opened the module and, at the same time, showed the "Just define / Enter the Tutor" popup, because the double click selected a word of the text under the pointer. The popup is for text the person selects on purpose. A double click on a box, a row or a label of the Canvas that opens or zooms something must not start a text selection and must not show that popup. Selecting text on purpose (in the Tutor, the chat, a Proposal, the code sheet) keeps working.

**Blocked by:** None (can start immediately).

**Status:** resolved (fix `3aca3d9`; checked with real double clicks 2026-11-04)

- [x] Double clicking a module box in the overview, a function row in a module and a Node on an authored layer opens it with no selection and no popup. (The rule is one CSS line over all of them, `user-select: none` in `src/ui/index.html`; checked on a Components Node with a real double click: empty selection, popup hidden.)
- [x] Dragging to select text in the Tutor column, the chat, a Proposal and the code sheet still shows the popup.
- [x] Verified live (headless Chrome on the main screen, not the second monitor, which is off): `.scratch/run-and-terminal/live-scripts/double-click-select.mjs`. A double click on a word of the Tutor column selects it and shows the popup. Only the Tutor column was tried of the four places listed.
