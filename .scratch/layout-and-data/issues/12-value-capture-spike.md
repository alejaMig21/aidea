# 12: Spike: what values can Playback capture, and in which languages

**Type:** prototype (throwaway)

**What to build:** A short investigation that answers, with evidence: which languages can record the values of a running function with their shape today (Python, TypeScript/JavaScript) given each adapter; how the identity of an object can be obtained in each, so that two names for one object are recognised; the cost of recording large values; and what the Playback guards allow. The verdict says what the structured-value contract (ticket 13) can promise and where the Data layer must say plainly that a language is not supported.

**Blocked by:** None (can start immediately).

**Status:** resolved (see Answer)

- [ ] A short written verdict in the log: per language, what can be captured, how identity works, what limits are needed.
- [ ] A measured cost for a list of 10,000 numbers and for a linked structure of 1,000 objects.
- [ ] A list of anything that cannot be captured (opaque values) and what Data should show for it.
- [ ] The spike code is discarded or kept on a `prototype/` branch; only the verdict is folded into tickets 13 to 15.

## Answer

Status: resolved

Evidence: `.scratch/layout-and-data/spike-12/` (`capture.py`, `run_py.py`, `run_js.mjs`, their `output_*.txt` and the recorded shapes in `shapes_py.json` / `shapes_js.json`). Nothing under `src/` or `test/` was changed.

### What exists today

- Playback records, per visit, `{step, locals}` where every local is `short(repr(value))`, cut at 80 characters (`snapshot` in `src/core/playback.py`). The run result is `{output, visits, truncated, error?, result}`; `playback.ts` stores it as the recording (`...outcome`) next to `narration`. Nothing keeps object identity, kind or fields.
- Python adapter: `run` spawns `playback.py` (a `sys.settrace` tracer, `MAX_STEPS = 2000`, only the outermost call is recorded). The snapshot runs inside the tracer, under the same audit hook as the person's code.
- TypeScript/JavaScript adapter: `analyze` and `flow` only. There is no `run`; the header of `typescript-adapter.ts` says "run comes with a later ticket" and `adapterFor` answers 422 "aidea cannot run functions of ... code yet". Ticket language-adapters/05 is `needs-info` (security decision of the person). So today Playback records no value of any TS/JS function, not even as text.

### Python: yes, shape and identity are capturable

- `capture.py` walks `frame.f_locals` at the same hook point and records kinds `scalar`, `seq` (list, tuple, set), `map`, `object` (fields from `__dict__` or `__slots__`), `ref`, `cut`, `opaque`. Verified: list, dict with a nested dict and an int key, a 2-node cycle (`a.next.next` came out as `{"kind":"ref","id":4}`, no infinite loop), a tree, `__slots__` objects, and an aliased list (`x["p"]` and `y["q"]` both point at id 9).
- Identity: `id(obj)`, compared inside one snapshot (a `seen` dict from `id` to a small number). Python ids are reused after an object dies, so they are not stable across visits by themselves. To mark "same object as in the previous visit" the recorder must keep the objects alive and number them in first-seen order across the whole run, not per snapshot. The spike numbers per snapshot only; the cross-visit numbering was not run.
- Guards: the audit hook blocks writes, reads outside the project, network and processes. Walking values uses none of those, so the capture passes the guards. Caveats: (1) a property or `__getattr__` on a custom class could run the person's code during capture; the spike reads `__dict__`/`__slots__` only and never calls `repr` on objects (safer than today's `repr`), but a `__slots__` read can hit a descriptor; (2) `json.dump` writes `NaN`/`Infinity` as bare tokens, which `JSON.parse` in the core rejects, so nan/inf floats must be sent as tagged text.
- Recursion: a recursive walk on a 1,000-long chain worked here, but the default limit is 1,000 and the person's code may already be deep, so an unlimited recursive walk can raise `RecursionError`. A depth limit removes this; without a limit an iterative walk is needed.

### TypeScript/JavaScript: nothing runs, but the value side is easy

Playback cannot run TS/JS at all, so the answer depends on ticket language-adapters/05, the person's decision. What the spike shows (`run_js.mjs`, wired to nothing): given the locals of a paused function, a recorder using a `WeakMap` as identity (JS has no `id()`; the object itself is the key, and a `WeakMap` gives stable ids across visits, unlike Python) captures arrays, `Map`, `Set`, plain objects, class instances, cycles and aliases, and marks functions, symbols and promises as opaque. What it does NOT answer: how the locals are obtained step by step. Options (not tried): the Node inspector protocol from a second process (`Debugger.paused`, `Runtime.getProperties`; objects come with an `objectId`, identity within a pause), or source instrumentation. Both are designs inside ticket 05, as is Node's permission model. Until 05 is decided, Data must say that TypeScript and JavaScript cannot record values yet.

### Cost (measured on this machine, Python 3.14 and Node 24)

| Case | Mode | Time for one snapshot | Size as JSON |
|---|---|---|---|
| 10,000 numbers (Python) | repr text today | 0.4 to 0.6 ms | 97 bytes |
| same | shape, limits (depth 6, 100 items, 500 nodes) | 0.17 ms | 4.9 KB |
| same | shape, no limit | 11 ms | 499 KB |
| 1,000 linked objects (Python) | repr text today | 0.01 ms | 176 bytes |
| same | shape, limits | 0.06 ms | 1.2 KB |
| same | shape, no limit | 5.5 ms | 138 KB |
| 10,000 numbers (JS, not wired) | limits / none | 0.07 ms / 3.2 ms | 4.6 KB / 469 KB |
| 1,000 linked (JS, not wired) | limits / none | 0.12 ms / 4.8 ms | 0.8 KB / 124 KB |

The multiplier is the visit count: a loop with 2,003 traced line events over a 10,000 list took 277 ms with limits and 21.7 s without (about 10.8 ms a visit), and an unlimited recording of it would be about 1 GB of JSON (2,003 visits x 0.5 MB). With `MAX_STEPS = 2000`, limits are mandatory, not an optimisation. Suggested defaults: depth 6, 100 items per container, 500 nodes per snapshot, plus a byte budget per recording (for example 4 MB) after which later visits record only changed locals or the run is marked `truncated`. A cut must say how much is hidden (`hidden`, `len`), which is story 57. Not measured: a wide object with thousands of fields; realistic functions.

### Opaque values and what Data shows

Not drawable, recorded as `{kind:"opaque", type, text}` and drawn as a plain labelled box with the type name: open files and other `io` objects, locks, threads, generators and coroutines, lambdas and functions, bound methods, modules, classes (the class object itself), frames and tracebacks; in JS functions, symbols, `Promise`, `WeakMap`/`WeakSet`, proxies. Objects with neither `__dict__` nor `__slots__` (C extension types) get the same box with the repr cut at 80 characters. Data never skips these silently (story 65).

### What the contract of ticket 13 can promise

- A tagged shape per local: `scalar | seq | map | object | ref | cut | opaque`, an id per run, `type` text, `len` and `hidden` on containers, and the existing text form kept unchanged.
- Python (today): all of it. Identity within a visit certainly; across visits if the recorder keeps objects alive and numbers them (small work, ticket 13). Change marks can come from a cheap fingerprint per local compared with the previous visit.
- TypeScript/JavaScript: the same shape can be the contract, but no value is recorded until language-adapters/05 gives the adapter a `run`. Data says plainly "values cannot be recorded for TypeScript yet", a limit and not a bug.
- Any other language: the adapter fills the same shape; an adapter without `run`, or an outcome without the structured field, makes Data show the plain note.
- Not promised: identity as a stable id across languages (Python ids are unique only among live objects), set iteration order, state hidden behind properties, and free capture (see limits).

### Not determined

How a JS function's locals would be read step by step (needs ticket 05); cost with the real tracer on many visits of a realistic function (only synthetic fixtures were run); numpy/pandas objects and objects whose `__dict__` is a property; the memory cost of keeping objects alive for cross-visit ids.
