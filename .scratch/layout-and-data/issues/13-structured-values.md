# 13: Playback records the shape of values, not only their text

**What to build:** For each visit and each variable, the Playback recording also carries a structured value: its kind (number, text, boolean, none, list, mapping, object with fields, reference to a value already described, or opaque with a label), its contents up to a size and depth limit, how much was cut, a stable identity so the same object seen from two variables is recognised, and a mark of what changed since the previous visit. The existing text form stays untouched, so Run, the trace table and the Tutor keep working.

**Blocked by:** 12 (value capture spike).

**Status:** implemented for Python (commit on this branch); TypeScript/JavaScript records nothing yet (see below)

- [x] Fixture functions build a list, a dictionary, linked objects with a cycle, a tree, an aliased object and a huge list; the protocol returns the expected kinds, contents, cut notes, identities and change marks. (`test/playback-shapes.test.ts`, fixtures in `test/fixtures/playback-shapes/shapes.py`; also opaque values, nan/inf/big ints, `__slots__`, depth and node cuts, the byte budget.)
- [x] The text form of every value is identical to before; existing Playback tests still pass. (`locals` is untouched; full suite green. The Tutor's recording read drops `shapes` so its size budget still covers the same number of steps.)
- [x] Limits keep the recording small and fast; the cut is stated, never silent. (`hidden`/`len`, `cut` with a `reason`, `shapesTruncated` at the byte budget.)
- [x] A language that cannot record shapes answers with a plain statement, not an error. (The field is simply absent: a visit without `shapes`, a recording without `shapesTruncated`. TypeScript/JavaScript still answers its existing plain 422 "cannot run functions yet" because it has no `run`; no test was added for an adapter that runs but cannot record shapes, because none exists.)
- [x] Nothing is written to the Project while recording. (Capture only reads; the audit hook is unchanged and `existsSync` checks in `playback.test.ts` still pass. No test of its own was added.)

## What was built

`Shaper` in `src/core/playback.py`, one per run. Each visit gains `shapes: {local name: shape}` next to `locals`.

```json
{"step": "...", "locals": {"items": "[1, 'two']"},
 "shapes": {"items": {"kind": "seq", "id": 0, "type": "list", "len": 2, "hidden": 0, "changed": true,
                      "items": [{"kind": "scalar", "type": "int", "value": 1}, {"kind": "scalar", "type": "str", "value": "two"}]}}}
```

- Kinds: `scalar` (None, bool, int, float, str, and subclasses such as enum members: the plain value with the subclass name as `type`), `seq` (list, tuple, set, frozenset: `items`), `map` (`entries`: list of `[key shape, value shape]`), `object` (`fields`), `ref` (`{kind, id}` of a list, dict, set or object already described in this visit; never of a tuple, frozenset, number, string or bytes, which are described in place and carry no `id`), `cut` (`reason`: `depth` or `nodes`, `id` when the object has one, `len` for containers; a cut object is described in full when met again elsewhere), `opaque` (`type` label only: files, functions, lambdas, modules, classes, generators, threads, locks, C-extension objects).
- `id`: numbered in first-seen order across the whole run; objects are kept alive so Python cannot reuse an id. That changes the person's program (`__del__` and weakref callbacks of shown objects do not fire before the end of the run, memory is held), so it is capped at 10,000 objects; past it shapes stop and `shapesTruncated` is set.
- `changed: true` on a local whose shape differs from its shape in the previous visit (or is new); absent when unchanged. Only the local as a whole is marked, not the node inside it that changed.
- nan/inf floats and ints beyond 2^53 are `{"value": "<text>", "tag": "float" | "int"}` so `JSON.parse` neither breaks nor rounds. An int of more than about 3,600 digits is `{"value": "1000000000...", "tag": "int", "digits": N}`: the value is NOT a number text (do not BigInt it) and is never built with `str()`. A str over 80 characters is cut and says `hidden: <characters not shown>`.
- Limits (the spike's suggestion): depth 6, 100 items per container, 500 nodes per visit (scalars count), 4,000,000 bytes of shapes per recording. Past the byte budget later visits keep their text and have no `shapes`, and the recording says `shapesTruncated: true` (a separate flag from `truncated`, which still means the run was cut short and has no result).
- Never calls `repr` or code of the person's on an object: built-in containers are read through the built-in methods (`list.__iter__`, `dict.items`), fields through `object.__getattribute__(v, "__dict__")` and the `__slots__` member descriptors. The existing text form still uses `repr`, as before.

## The contract is small on purpose

DECISION 5 in `.scratch/overnight/LOG.md` was written by the spike agent and is NOT yet confirmed by the person. This ticket keeps to what the spike can support: the shape above, Python only, per-local change marks. Names (`shapes`, `ref`, `cut`, `tag`, `shapesTruncated`) are this agent's choice and cheap to rename before ticket 14 draws them. Nothing here promises ids across languages or sets in a stable order.

## Measured (this machine, Python 3.14; `Shaper.snapshot` alone, 200 repeats)

| Case | Time per visit | Size per visit |
|---|---|---|
| list of 10,000 numbers | 0.26 ms | 4.9 KB |
| 1,000 linked objects | 0.06 ms | 0.8 KB |

Also measured by a test: a loop of about 400 visits over five 100-number lists reaches the 4 MB budget, is marked `shapesTruncated`, and the whole test takes under 2 seconds.

## Not done or not measured

- TypeScript/JavaScript: no adapter `run`, so nothing is recorded (language-adapters/05 still decides).
- Cost with the real tracer on a realistic function; the memory held by keeping objects alive (bounded by roughly 500 nodes per visit and 2,000 visits, not measured); numpy/pandas objects; an object whose `__dict__` is a property of the person's (it would run their code; considered too rare to guard).
- No test proves `repr` is never called: the text form calls it already, so the protocol cannot observe the difference. The shape test with a raising `__repr__` and a raising property only shows capture survives them.
- Change marks are per local, not per field or item.

## Review fixes (fresh-context review, ten findings)

One honest line each. All have a test in `test/playback-shapes.test.ts` that was red first, except where said.

1. Huge int: `10**5000` used to raise inside the tracer and break the Playback; now tagged without `str()`. The whole shaping call is also wrapped in `try/except Exception` in `record()`: a failure drops `shapes` for that visit (text stays, `shapesTruncated` is NOT set), tested with a metaclass whose `__name__` raises. A 10 MB string is cut with `hidden`; the text form (`locals`) still copies it once through `repr`, as before.
2. `len()` and `itertools.islice` replace copying the container. Measured by test only: 200 visits over a list of 1,000,000 numbers took about 5.1 s before and well under the 2.5 s bound after (this machine; the bound is generous, not a benchmark).
3. Stubs now spend the node budget and a container stops adding items once it is spent (`hidden` says how many). The byte budget is checked after each local, so the visit that would cross it is dropped (no shapes) instead of recorded. Not reproducible as "several MB": the old worst case was about 500 nodes plus 100 stubs per open ancestor, so the wide-structure test (200 lists of 200) was already green; it stays as a guard. The mid-visit byte check has no test of its own.
4. Kinds use `type()` and `issubclass()`; a `__class__` property that records calls is never run.
5. Tuples, frozensets, numbers, strings and bytes carry no id and never become a `ref`; opaque values no longer get an id either (they could be pointed at without being described). bytearray is opaque, in place.
6. An object is added to `seen` only after it passes the depth and node cuts; a cut stub carries its `id`, and the object is described in full when met again.
7. int, float and str subclasses (IntEnum, `str` enums) are their plain value read with `int.__pos__`, `float.__float__`, `str.__str__` (no subclass method runs), with the subclass name as `type`. A plain `Enum` member is still an object with its `_name_` / `_value_` fields.
8. Name-mangled slots (`__x`) are read as `_Class__x` and shown as written. Not handled: a mangled name on a base class whose name starts with underscores only.
9. The keep list is documented in the class docstring and capped at 10,000 objects (then `shapesTruncated`). Not measured: memory at the cap.
10. `make_loud` records every call in a module-level list that the test reads back (only the text form's `repr` is allowed, checked through the caller name); added tests for a subclassed list with a raising `__iter__` / `__len__`, dictionary keys (nested tuple, object with a custom hash), an unhashable object in a list, and `__getattr__`.

Also changed: `ids` are no longer present on tuples/frozensets (`seq` without `id`). Ticket 14 must not rely on them.
