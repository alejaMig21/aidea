# 02: Measure what the person knows, inside the conversation

**What to build:** Replace the Probe (a separate run per layer with a fixed list of concepts) by a measurement inside the conversation, as LearnHarness does: the Tutor asks the goal if it is not clear, and asks questions per prerequisite topic that it chooses, starting near the hardest thing the goal needs, to find the floor and the ceiling. It stops when every topic is bracketed and the goal is concrete, and records the result once. The person can say they know something and skip it. What was measured feeds the Learner graph.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser; the real Tutor was not started)

- [x] A fake Tutor that asks, records the bracket per topic and finishes once is accepted; one that finishes twice or while a question is open is refused.
- [x] A topic the Learner graph already holds is not asked again.
- [x] The person can skip a question with "I already know this" and it counts as known, not as a lie detector.
- [x] The per-layer Probe is gone (route, role, tools, card); its fixed concept list stays until tutor-rewrite 08.
- [x] Core API tests pass; `npm run verify` is green.

Source: `.scratch/tutor-rewrite/spec.md` and ADR 0010.

## What was built (2026-11-05)

- The Tutor measures inside its own session with two new tools: `measure {topic, kind, prompt, ...}` (one question per topic, at most 12, refused for a topic the Learner graph already holds or that was already asked, "I already know this" always offered and recorded as `probe-skip` Evidence) and `measure_done {topics: [{name, floor, ceiling, note}]}`, accepted once. `floor` is the hardest thing the person reliably got right and `ceiling` the easiest they got wrong or did not know (each text or null). State per session lives in `teach.ts` (`lesson.measure`); validation in `measure.ts` (`parseBrackets`).
- The result is stored per Project (`measures.jsonl` in the learner folder) and read with `GET /tutor/measure?project=`; `get_plan` returns it as `measure` next to the Plan. `TUTOR_INSTRUCTIONS` step 0 is now "Measure, then the Plan" (kept under 4000 characters: it goes on the Windows command line).
- Removed: the Probe: `routes/tutor-probes.ts`, the Prober role (types, permissions, adapter, MCP branch), `PROBE_TOOLS`, the stored per-layer results, the offer line and script `51-probe.js`, and its test file. `probe.ts` became `measure.ts`. The layer concept list `LAYER_CONCEPTS` stays there until tutor-rewrite 08 (the layer classes and the Plan still read it); that box moved to ticket 08.
- Tests: `test/measure.test.ts` (8). Live (main monitor): `.scratch/tutor-rewrite/live-scripts/measure.mjs`: in Electron's runtime a stand-in Tutor asks two questions (one skipped), hands over once, a second hand-over is refused and the result is stored; the real window has no Probe route, no offer line, no `probeUi`, and no page errors. The real Tutor was not started (it spends the person's quota).
