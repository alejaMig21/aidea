# 10: A structural index of any language, from a replaceable provider

**What to build:** A slot for an index provider that builds, in the background and cached outside the Project, a map of modules, symbols, imports and calls for the languages it knows, in the same shape as aidea's own analysis (nodes and relationships with a resolution). The first provider is Codebase Memory MCP (it writes nothing into the Project by default; one background process per account means aidea shares the person's cache); an own provider on tree-sitter compiled to WebAssembly may replace it later. The index chooses what the Tutor reads; it is not the source of intent.

**Blocked by:** language-plugins 01, language-plugins 07, layer-inference 11.

**Status:** needs-info: the measured comparison of Codebase Memory (the spike in the backlog) before it becomes the first provider

- [ ] The provider slot is described in `docs/plugin-api.md`.
- [ ] A fixture provider that returns a small map fills the Components layer for a language aidea has no plugin for.
- [ ] The provider runs in the background and never blocks opening (ticket 01).
- [ ] The licence and the per-system program of the first provider are checked and written here.

Source: `.scratch/layer-inference/spec.md`; the exam in `.scratch/layer-inference-exam/results.md`.
