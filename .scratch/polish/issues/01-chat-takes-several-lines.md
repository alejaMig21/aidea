# 01: The chat with the builder takes several lines

**What to build:** The text box for talking to the builder accepts several lines. A person can paste a numbered list, one item per line, and the builder receives it exactly as written. Enter sends the message; Shift+Enter starts a new line. The box grows with its content up to a limit and then scrolls. Sending, the disabled state while the builder answers, and the accessible label behave as before.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Pasting text with line breaks keeps every line break in the box and in the message the builder receives (checked through the protocol: the message sent to the core contains the same lines).
- [ ] Enter sends; Shift+Enter inserts a line break and does not send; Enter during text composition (an input method) does not send.
- [ ] The box grows with its content up to a maximum height and then scrolls; an empty box goes back to one line after sending.
- [ ] Verified with a headless browser: screenshot of a pasted numbered list in the box, one of the same list in the sent message, no console errors, and no overflow in a narrow column.
