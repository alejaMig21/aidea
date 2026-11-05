# 08: The Tutor stops knowing the layers, the differences, the Contract and the guide by name

**What to build:** Remove from the Tutor everything written about parts of aidea: the layer concepts and the layer class messages, the tools that build the authored layers (they become the layer plugins' own), the guide class, the drift class and the Contract sections. What is left is the method plus the tools to read a plugin's lesson, view and checks. A test fails if the Tutor's instructions or tools name a layer or the Contract.

**Blocked by:** roles-and-contract 04, plugin-lessons 05, tutor-rewrite 09.

**Status:** ready-for-agent

- [ ] A test searches the Tutor's instructions, tools and openings for layer, Contract and difference names and finds none.
- [ ] The Tutor still explains the purpose of each layer and how to use aidea, from lessons (a fake Tutor reads them).
- [ ] Every part that was taught by the old code is taught by a lesson (a list proves it).
- [ ] No code path knows a kind of class (a test searches for the old kinds; moved here from tutor-rewrite 01).
- [ ] Core API tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.
