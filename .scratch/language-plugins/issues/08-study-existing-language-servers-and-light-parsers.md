# 08: Study: existing language servers or a light parser for analyze

**What to build:** Two ways to read many languages without writing an analyzer for each: reuse the language servers that exist (they give symbols and references) or a light parser compiled to WebAssembly (one small file for every system). For three languages, compare each with aidea's own analysis and with the index provider: what they return, how fast, how accurate the relations, how they travel with a plugin.

**Blocked by:** layer-inference 10.

**Status:** ready-for-agent (a study)

- [ ] A comparison table for three languages.
- [ ] A recommendation, with the cost of switching from the TypeScript compiler.
- [ ] No code is replaced by this ticket.

Source: `.scratch/language-plugins/spec.md`, the decided section.
