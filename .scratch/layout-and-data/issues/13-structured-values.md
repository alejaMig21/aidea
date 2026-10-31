# 13: Playback records the shape of values, not only their text

**What to build:** For each visit and each variable, the Playback recording also carries a structured value: its kind (number, text, boolean, none, list, mapping, object with fields, reference to a value already described, or opaque with a label), its contents up to a size and depth limit, how much was cut, a stable identity so the same object seen from two variables is recognised, and a mark of what changed since the previous visit. The existing text form stays untouched, so Run, the trace table and the Tutor keep working.

**Blocked by:** 12 (value capture spike).

**Status:** ready-for-agent

- [ ] Fixture functions build a list, a dictionary, linked objects with a cycle, a tree, an aliased object and a huge list; the protocol returns the expected kinds, contents, cut notes, identities and change marks.
- [ ] The text form of every value is identical to before; existing Playback tests still pass.
- [ ] Limits keep the recording small and fast; the cut is stated, never silent.
- [ ] A language that cannot record shapes answers with a plain statement, not an error.
- [ ] Nothing is written to the Project while recording.
