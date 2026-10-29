# 07: Methods and effects data without JSON

**What to build:** The same form covers methods and effects. For a method, the analysis also reports the constructor's parameters, shown as extra fields so the instance can be built without JSON. For an Algorithm that reads files or calls the network, the data for those effects is a set of labelled rows, each prefilled with a sample and written as literals, instead of a hand-written object.

**Blocked by:** 06

**Status:** done

- [x] Through the core protocol: analysis of a method reports the constructor parameters with defaults, annotations and suggestions.
- [x] Playback of a method builds the instance from the constructor values.
- [x] Effects data arrives as named rows of literals and is applied; a non-literal row is refused and not run.
- [x] Earlier Playback guarantees still hold.
- [~] Checked live: constructor fields and effect rows appear prefilled and run.

## Review notes

Tested automatically (test/params.test.ts, test/playback.test.ts): analysis of a method reports `constructorParameters` (default, annotation, suggestion; `[]` without `__init__`) and its own `parameters` without `self`; analysis lists `effects` per function (call name plus a sample literal: `open` gives text, other calls give `{"status": 200}`); Playback builds the instance from `instanceValues` (literals, blank uses the default); effects arrive as `effects` rows of literals and become the fakes; a bad or non-literal constructor value or effect row is refused on its own field (`constructor.<name>`, `effect:<name>`) and never run (marker file never created); size and name limits on the new inputs; earlier guarantees (limits, static effect check, own-Python opt-in, timeouts) still pass. The old `args`/`kwargs`/`instance`/`fakes` JSON path stays in the core because existing tests use it; the interface no longer shows it.

Needs live checking (left unticked): constructor fields, argument fields and effect rows appear prefilled and labelled, "Use example" refills all of them, per-field errors show under the right field, and a recording runs from the form and restores the typed values.

`[~]` = closed as done without this check being recorded at the time; not re-verified (cleaned up on 2026-10-30, history in git).
