# 01: The Tutor: one continuous session, any question

**What to build:** Rewrite the session of the Tutor: one conversation, started by a question or a goal, that needs an Open Project and accepts anything the person asks. The kinds of class that depend on where it was started disappear as kinds: the interface attaches context to the question (selected text, a Node, a difference, a plugin waiting in the quarantine, the aidea guide) and the Tutor decides what to teach. The session survives a pause and the person can end it. The tools of the Tutor stay separate from the Builder's.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (the session shape; the kinds themselves go in tutor-rewrite 08)

- [x] With no Open Project the Tutor does not start and says why in plain words.
- [x] A free question about anything starts a session; the old entry points start the same session with context attached, and contexts combine.
- Moved to tutor-rewrite 08 (the kinds go when their plugins own what they taught): no code path knows a kind of class.
- [x] The Tutor's tools stay separate from the Builder's and it still cannot write files or run commands.
- [x] Core API and page tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.

## What was built (2026-11-05)

- `routes/tutor.ts`: one session. `message` is the person's question (any text, up to 20,000 characters, refused if not text); `guide`, `layer`, `drift`, `selection` and `plugin` only attach context, all of it, and the question comes first ("The person asks: ..."). With no context the opening is the question, the topic, or the old free start (with its review question). With no Open Project the Tutor answers in plain words: "Open a project first: ...".
- Tests: `test/tutor-one-session.test.ts` (5). Live: `.scratch/tutor-rewrite/live-scripts/session.mjs` on the main monitor: in Electron's runtime a stand-in Tutor receives the free question, the question plus the guide, and the question plus the guide plus selected text; the real window refuses a question with no project open and one that is not text. The real Tutor was not started (it spends the person's quota).
- What is NOT done here, by design: the kinds of class still exist inside (layer authoring, the guide's `setAboutAidea`, the review rule). They go in tutor-rewrite 08, when the plugins that own what they taught exist; that box moved there. The interface still sends one context at a time until tutor-rewrite 07 rebuilds the panel.
