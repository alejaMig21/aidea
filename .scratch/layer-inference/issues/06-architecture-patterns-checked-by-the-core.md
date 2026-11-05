# 06: Architecture patterns are judged by the Tutor and checked by the core

**What to build:** The Tutor proposes the boxes a person would draw and the pattern they follow (layered, hexagonal, event-driven, plugin-based) as a Pattern group with a role for each box, with evidence. The core checks the pattern against the real relationships with no model: for layered, no dependency goes upward; for hexagonal, no domain module imports an adapter; for event-driven, modules talk through the bus. A claim the code contradicts is shown as a Difference of type pattern and not drawn as fact. The Pattern groups and the check exist for the first kinds (tutor 14); this extends them and the rule that the claim must hold.

**Blocked by:** layer-inference 03, tutor-rewrite 04.

**Status:** ready-for-agent

- [ ] The core has a rule set for layered, hexagonal, event-driven and plugin-based, each tested on a fixture that follows it and one that breaks it.
- [ ] A Pattern group the code contradicts shows the broken relations in plain words.
- [ ] The drawing shows boxes, relations and the pattern, never the raw code graph.
- [ ] On Telegram a scripted Tutor proposes the hexagonal group and the check passes with the real relationships.

Source: `.scratch/layer-inference/spec.md`; the exam in `.scratch/layer-inference-exam/results.md`.
