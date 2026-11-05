# 07: The Tutor panel: one chat, the Plan, practice

**What to build:** Rebuild the interface of the Tutor on the new session: one conversation, the Plan beside it (items, dependencies, the current one) and a way to ask for practice. The context menu (selected text, a Node, a difference) attaches context to a question. The Differences and Contract sections leave the panel with roles-and-contract 04.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The panel shows the conversation, the Plan and a Practice entry (a button that starts `{practice: true}`), and nothing of the old class kinds.
- [ ] Asking from a selection or a Node attaches it as context.
- [ ] It works at 1920 and 1280 pixels and with the keyboard; the legend and layer tests pass.
- [ ] The Plan panel shows items, dependencies and the current one (moved from tutor-rewrite 03).
- [ ] A live check on the main monitor with the real Tutor (quota).

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.
