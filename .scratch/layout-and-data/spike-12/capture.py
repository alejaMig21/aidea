"""Throwaway: structured value capture under sys.settrace, same hook point as src/core/playback.py `snapshot`.
Shape = {"kind", "id", ...}; an object met twice in one snapshot becomes {"kind": "ref", "id": n}.
Limits: depth, items per container, total nodes."""
import io
import threading
import types

OPAQUE = (types.FunctionType, types.BuiltinFunctionType, types.MethodType, types.GeneratorType, types.CoroutineType,
          types.ModuleType, types.FrameType, types.TracebackType, io.IOBase, threading.Thread, type(threading.Lock()), type)


def capture(value, limits, seen, depth=0, budget=None):
    budget = budget if budget is not None else [limits["nodes"]]
    if value is None or isinstance(value, (bool, int, float, str, bytes)):
        text = value if isinstance(value, (bool, int, float, str, type(None))) else repr(value)
        if isinstance(text, str) and len(text) > 80:
            text = text[:79] + "…"
        return {"kind": "scalar", "type": type(value).__name__, "value": text}
    if isinstance(value, OPAQUE):
        return {"kind": "opaque", "type": type(value).__name__, "text": f"<{type(value).__name__}>"}
    oid = id(value)
    if oid in seen:
        return {"kind": "ref", "id": seen[oid]}
    seen[oid] = len(seen)
    me = seen[oid]
    if budget[0] <= 0 or depth >= limits["depth"]:
        return {"kind": "cut", "id": me, "type": type(value).__name__, "reason": "depth" if depth >= limits["depth"] else "nodes"}
    budget[0] -= 1
    cap = limits["items"]
    sub = lambda v: capture(v, limits, seen, depth + 1, budget)
    if isinstance(value, (list, tuple, set, frozenset)):
        items = list(value)
        return {"kind": "seq", "type": type(value).__name__, "id": me, "len": len(items),
                "items": [sub(v) for v in items[:cap]], "hidden": max(0, len(items) - cap)}
    if isinstance(value, dict):
        items = list(value.items())
        return {"kind": "map", "id": me, "len": len(items),
                "entries": [[sub(k), sub(v)] for k, v in items[:cap]], "hidden": max(0, len(items) - cap)}
    fields = getattr(value, "__dict__", None)
    if fields is None and hasattr(type(value), "__slots__"):
        fields = {s: getattr(value, s) for s in type(value).__slots__ if hasattr(value, s)}
    if fields is not None:
        items = list(fields.items())
        return {"kind": "object", "type": type(value).__name__, "id": me,
                "fields": {k: sub(v) for k, v in items[:cap]}, "hidden": max(0, len(items) - cap)}
    return {"kind": "opaque", "type": type(value).__name__, "text": repr(value)[:80]}


def snapshot(frame, limits):
    seen = {}  # one id space per snapshot: aliasing across locals is recognised
    return {n: capture(v, limits, seen) for n, v in list(frame.f_locals.items()) if not n.startswith("__")}


def short(value, limit=80):
    try:
        t = repr(value)
    except Exception:
        t = f"<{type(value).__name__}>"
    return t if len(t) <= limit else t[: limit - 1] + "…"
