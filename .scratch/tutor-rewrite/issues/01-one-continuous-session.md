# 01: The Tutor: one continuous session, any question

**What to build:** Rewrite the session of the Tutor: one conversation, started by a question or a goal, that needs an Open Project and accepts anything the person asks. The kinds of class that depend on where it was started disappear as kinds: the interface attaches context to the question (selected text, a Node, a difference, a plugin waiting in the quarantine, the aidea guide) and the Tutor decides what to teach. The session survives a pause and the person can end it. The tools of the Tutor stay separate from the Builder's.

**Blocked by:** None (can start immediately).

**Status:** needs-info: the person approves the spec

- [ ] With no Open Project the Tutor does not start and says why in plain words.
- [ ] A free question about anything starts a session; the old entry points start the same session with context attached.
- [ ] No code path knows a kind of class (a test searches for the old kinds).
- [ ] The Tutor's tools stay separate from the Builder's and it still cannot write files or run commands.
- [ ] Core API and page tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.
