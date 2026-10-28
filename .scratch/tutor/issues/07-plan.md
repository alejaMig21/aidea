# 07: Plan: concepts in dependency order, and the questions stay inside it

**What to build:** After measuring, the Teacher builds a Plan for the Project: concepts to understand, in dependency order, and the open decisions of each layer. It is stored per person and per Project outside the repository, shown in the Tutor column as a readable list, and revised when the person asks for changes in the conversation (never edited by hand). The core enforces it: a predict or check question that is not about an item of the Plan is rejected with an error the model can act on. Items are not marked "done"; what the person has covered is derived from the Evidence and the graph.

**Blocked by:** 05, 06

**Status:** ready-for-agent

- [ ] Through the protocol with a scripted Teacher: setting a plan with dependencies is stored and returned; a question about an item outside the plan is rejected; a revised plan replaces the old one and keeps what is still valid.
- [ ] A plan with a cycle is rejected.
- [ ] The covered part is derived from Evidence and graph, not stored.
- [ ] The plan survives a core restart and lives outside the Project folder.
- [ ] Verified with a headless browser: screenshot of the Plan in the Tutor column; no console errors.
