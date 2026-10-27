# 06: Test-data form for functions (Python literals, no JSON)

**What to build:** Testing an Algorithm that is a plain function no longer asks for JSON. The Algorithm analysis reports each parameter in order with its default value and type annotation when present. The interface shows one labelled field per parameter, prefilled with a suggested example: from the default value, then from the annotation (a small plain example per basic type), else empty with a hint. A "Use example" button refills the suggestions. Values are written as in Python (`3`, `"hi"`, `[1, 2, 3]`, `None`, `True`). The Playback receives values per parameter. They are evaluated by a literal-only evaluator: anything that is not a plain literal (call, name, operator, comprehension) is refused with an error naming the parameter and is never executed. A malformed literal is reported against its own field. The form can live where the test data is today until ticket 08 moves it.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Through the core protocol: analysis of a function reports parameters in order with default and annotation.
- [ ] Suggestions come from the default, then the annotation, else none.
- [ ] Playback runs with valid literals of each basic type (int, float, str, bool, None, list, dict, tuple).
- [ ] A malformed literal is reported naming its parameter.
- [ ] A call such as `__import__("os")`, a bare name or an expression is refused and demonstrably not run.
- [ ] Size limits and earlier Playback guarantees (static effect check, own-Python opt-in, timeouts) still hold.
- [ ] Checked live: fields labelled by parameter, prefilled, "Use example" works, errors show on the right field.
