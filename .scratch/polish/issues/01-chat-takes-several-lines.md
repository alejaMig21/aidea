# 01: The chat with the builder takes several lines

**What to build:** The text box for talking to the builder accepts several lines. A person can paste a numbered list, one item per line, and the builder receives it exactly as written. Enter sends the message; Shift+Enter starts a new line. The box grows with its content up to a limit and then scrolls. Sending, the disabled state while the builder answers, and the accessible label behave as before.

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Pasting text with line breaks keeps every line break in the box and in the message the builder receives (checked through the protocol: the message sent to the core contains the same lines).
- [x] Enter sends; Shift+Enter inserts a line break and does not send; Enter during text composition (an input method) does not send.
- [x] The box grows with its content up to a maximum height and then scrolls; an empty box goes back to one line after sending.
- [x] Verified with a headless browser: screenshot of a pasted numbered list in the box, one of the same list in the sent message, no console errors, and no overflow in a narrow column.

## Review notes

- [x] Protocol: the core already passed the message through untouched; `test/chat.test.ts` now has a guard that a message of several lines (blank lines and indentation included) reaches Claude Code on stdin exactly as written (384 tests, 383 pass, 1 skipped; typecheck clean). The change itself is in the interface, so the red-first check was a headless run: before the change the box was an `<input>` (a pasted list collapsed to one line and Shift+Enter sent); after it, all of the checks below pass.
- [x] `src/ui/features/30-chat.js`: the box is a `textarea` that grows from one line up to 160px and then scrolls; Enter sends, Shift+Enter makes a new line, Enter that confirms an input-method composition does neither; sending empties it and shrinks it back. The sent bubble keeps the lines (it already used `pre-wrap`). Styles in `index.html`.
- [x] Verified in headless Chrome (no window, so nothing on any monitor): a pasted five-item list shows five lines, Shift+Enter adds one without sending, Enter sends exactly the list, 40 lines cap at 160px and scroll inside, no horizontal overflow at 700px, no console errors.
- [x] Also fixed in passing: the "review question" checkbox of ticket 15 was drawn above its text; it is on one line now.
- NOT done: the text is still trimmed at both ends before it is sent (as before); a draft is not kept if the person switches Project.
