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

- Kinds: `scalar` (None, bool, int, float, str), `seq` (list, tuple, set, frozenset: `items`), `map` (`entries`: list of `[key shape, value shape]`), `object` (`fields`), `ref` (`{kind, id}` of an object already described in this visit), `cut` (`reason`: `depth` or `nodes`, `len` for containers), `opaque` (`type` label only: files, functions, lambdas, modules, classes, generators, threads, locks, C-extension objects).
- `id`: numbered in first-seen order across the whole run; objects are kept alive so Python cannot reuse an id.
- `changed: true` on a local whose shape differs from its shape in the previous visit (or is new); absent when unchanged. Only the local as a whole is marked, not the node inside it that changed.
- nan/inf floats and ints beyond 2^53 are `{"value": "<text>", "tag": "float" | "int"}` so `JSON.parse` neither breaks nor rounds.
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
