# 01: Ideas on the Learner graph have plain names and fewer near-duplicates

**What to build:** In a live run with the real Claude Code, one class of four steps saved 20 ideas, and a class on a layer saved 21. Their names were code identifiers (`append_adds_to_end`, `list_is_cart_memory`, `same_total_not_same_info`) and several said nearly the same thing (`list_keeps_repeats`, `list_never_drops`, `list_keeps_full_info`). The names are what the person reads when the graph is shown, and the statements are what review questions are built from, so they should read as a short phrase in plain words, and one fact taught several ways in a class should end up as one idea. Change the instructions of the Extractor and the Auditor (and, if needed, how the core merges) so that: a name is a short plain-words phrase of at most about six words with no underscores or code punctuation; an idea is one fact that could be asked about on its own; the same fact stated twice in a class is one idea; and a class of a few steps saves a handful of ideas, not twenty.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Through the protocol with a scripted Extractor and Auditor: names with underscores or code punctuation are rejected with a message the model can act on, or normalised to words, and the rule is stated in the Extractor's instructions (kept under 4000 characters).
- [ ] The Auditor is told to merge ideas that say the same fact; a scripted Auditor link merges them into one idea with both names as aliases (as today) and the merger, not the model, picks the name.
- [ ] A class whose Teacher prose states the same fact in three ways, run through the scripted roles, ends with one idea for it.
- [ ] Verified live with the real Claude Code on the second monitor: a class like the one of the live run saves a handful of ideas with plain names (record the numbers before and after).
- [ ] Nothing changes for ideas already saved (no migration); `GLOSSARY.md` terms (Proposition, Learner graph) still hold.
