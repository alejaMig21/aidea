"""Run one Python function under a tracer and print what happened as JSON.

Usage: playback.py <project folder> <module id> <qualified name> <file>
Standard input: {"values": {parameter: Python literal text}, "instanceValues": {constructor parameter: literal text},
  "effects": {call name: literal text}} or {"args": [...], "kwargs": {...}}, plus {"instance": {"args": [...], "kwargs": {...}} or null, "fakes": {name: value}}
Standard output: {"invalid": {parameter: message}} when a value is not a plain literal (it is parsed, never run),
  {"refused": [{"name", "line"}]} when the function has external effects that are not replaced,
  {"unsupported": "..."} for generators and async functions, or
  {"result", "output", "visits": [{"step", "locals"}], "truncated", "error"?} after running it.
Exit codes: 2 = the function is not in the file; 3 = the file cannot be read as Python.

THIS RUNS THE PROJECT'S OWN CODE, including whatever the module does when it is imported. The inputs are JSON values or
Python literals parsed with ast.literal_eval, never code. Two guards help against accidents:
  1. before running, calls in the function's own body that read or write the outside world (files, network, processes,
     native code) are refused unless the person replaced them with fake data. This looks at names only;
  2. while running, an audit hook stops file writes, reads outside the project and the Python installation, network
     access, new processes and calls into native code, even when they are hidden inside a helper. (Loading a native
     library is allowed: `import ctypes` itself does it on Windows, and many packages import ctypes.)
Both are a safety net for mistakes. They are NOT a sandbox: code written to get around them can. Only play code you trust.
"""
import ast
import builtins
import contextlib
import copy
import importlib
import importlib.util
import inspect
import io
import json
import os
import sys
import sysconfig
import threading
import types

from effects import import_aliases, is_effect, resolve_alias  # sits next to this file; analyze.py reaches import_aliases through here

MAX_STEPS = 2000  # a run that records more steps than this is cut short (for example an endless loop)
MAX_TEXT = 80
# Limits of the structured form of one visit (measured in .scratch/layout-and-data/spike-12): depth, items per container,
# nodes per visit, and the bytes of all structured forms in one recording.
SHAPE_DEPTH, SHAPE_ITEMS, SHAPE_NODES, SHAPE_BYTES = 6, 100, 500, 4_000_000
# Values that are drawn as a labelled box, never opened.
OPAQUE = (types.FunctionType, types.BuiltinFunctionType, types.MethodType, types.GeneratorType, types.CoroutineType,
          types.ModuleType, types.FrameType, types.TracebackType, io.IOBase, threading.Thread, type(threading.Lock()), type)

# Audit events that are stopped while the function runs. Python names them after the operation.
BLOCKED_EVENTS = {
    "os.system", "os.exec", "os.posix_spawn", "os.spawn", "os.startfile", "os.remove", "os.rename", "os.rmdir", "os.mkdir",
    "os.chmod", "os.chown", "os.truncate", "os.utime", "os.symlink", "os.link", "os.mkfifo", "os.mknod", "os.kill",
    "os.putenv", "os.unsetenv", "os.add_dll_directory", "shutil.copyfile", "shutil.copy", "shutil.copymode",
    "shutil.copystat", "shutil.copytree", "shutil.rmtree", "shutil.move", "shutil.chown", "shutil.make_archive",
    "shutil.unpack_archive", "tempfile.mkstemp", "tempfile.mkdtemp", "sqlite3.connect", "webbrowser.open",
    "ctypes.call_function", "ctypes.call_cdeclfunction",
}
# Whole families of events: processes, the network and the Windows system calls behind them.
BLOCKED_PREFIXES = (
    "subprocess.", "socket.", "urllib.", "http.", "ftplib.", "smtplib.", "imaplib.", "poplib.", "telnetlib.",
    "_winapi.", "winreg.", "msvcrt.", "multiprocessing.",
)


class StopRecording(BaseException):
    """Raised from the tracer to cut a run short. Not an Exception, so the function's own `except` cannot hide it."""


def load_flow():
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location("_aidea_flow", os.path.join(here, "flow.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def effects_of(function, fakes, aliases):
    """Calls in the function's own body that touch the outside world and are not replaced.
    This looks at names only: a helper that the function calls is not inspected (the audit hook covers it)."""
    found = []
    for node in ast.walk(function):
        if not isinstance(node, ast.Call):
            continue
        name = ast.unparse(node.func)
        resolved = resolve_alias(name, aliases)
        if name in fakes or resolved in fakes:
            continue
        if is_effect(resolved):
            found.append({"name": name, "line": node.lineno})
    return sorted(found, key=lambda e: (e["line"], e["name"]))


def install_audit_hook(readable_roots):
    write_flags = os.O_WRONLY | os.O_RDWR | os.O_APPEND | os.O_CREAT | os.O_TRUNC
    roots = [os.path.normcase(os.path.realpath(r)) for r in readable_roots]

    def may_read(path):
        if isinstance(path, int):  # a file that is already open
            return True
        try:
            real = os.path.normcase(os.path.realpath(os.fsdecode(path)))
        except (TypeError, ValueError):
            return False
        return any(real == r or real.startswith(r + os.sep) for r in roots)

    def hook(event, args):
        if event == "open":
            path, mode, flags = args
            if (isinstance(mode, str) and any(c in mode for c in "wax+")) or (isinstance(flags, int) and flags & write_flags):
                raise PermissionError("blocked by aidea: writing a file")
            if not may_read(path):
                raise PermissionError("blocked by aidea: reading a file outside the project")
        elif event in BLOCKED_EVENTS or event.startswith(BLOCKED_PREFIXES):
            raise PermissionError(f"blocked by aidea: {event}")

    sys.addaudithook(hook)


def make_fake(name, value):
    if name == "open" and isinstance(value, str):
        return lambda *a, **k: io.StringIO(value)
    return lambda *a, **k: copy.deepcopy(value)


def patch(module, name, value):
    fake = make_fake(name, value)
    if "." not in name:
        target = builtins if hasattr(builtins, name) and name not in vars(module) else module
        setattr(target, name, fake)
        return
    root, *rest = name.split(".")
    base = getattr(module, root, None)
    if base is None:
        base = importlib.import_module(root)
    for part in rest[:-1]:
        base = getattr(base, part)
    setattr(base, rest[-1], fake)


def short(value, limit=MAX_TEXT):
    try:
        text = repr(value)
    except Exception:
        text = f"<{type(value).__name__}>"
    return text if len(text) <= limit else text[: limit - 1] + "…"


def snapshot(frame):
    return {name: short(value) for name, value in list(frame.f_locals.items()) if not name.startswith("__")}


class Shaper:
    """The structured form of the locals, next to their text. One per run, so an object keeps the same id on every visit.

    NEVER calls repr, a property or any method the person wrote: it reads the built-in containers through their built-in
    methods and the fields of an object straight from __dict__ / __slots__ descriptors. Objects are kept alive for the
    run, so Python cannot reuse an id for another object; ids count up in the order objects are first seen."""

    def __init__(self):
        self.ids, self.keep, self.previous, self.bytes, self.full = {}, [], {}, 0, False

    def number(self, value):
        key = id(value)
        if key not in self.ids:
            self.ids[key] = len(self.ids)
            self.keep.append(value)
        return self.ids[key]

    def shape(self, value, seen, budget, depth=0):
        kind = type(value)
        if value is None or kind in (bool, int, float, str):
            if budget[0] <= 0:
                return {"kind": "cut", "type": kind.__name__, "reason": "nodes"}
            budget[0] -= 1
            return self.scalar(value)
        if isinstance(value, OPAQUE):
            return {"kind": "opaque", "type": kind.__name__}
        number = self.number(value)
        if number in seen:
            return {"kind": "ref", "id": number}
        seen.add(number)
        base = next((b for b in (list, tuple, set, frozenset, dict) if isinstance(value, b)), None)
        if budget[0] <= 0 or depth >= SHAPE_DEPTH:
            cut = {"kind": "cut", "id": number, "type": kind.__name__, "reason": "depth" if budget[0] > 0 else "nodes"}
            if base:
                cut["len"] = base.__len__(value)
            return cut
        budget[0] -= 1
        sub = lambda v: self.shape(v, seen, budget, depth + 1)
        if base is dict:
            items = list(dict.items(value))
            return {"kind": "map", "id": number, "type": kind.__name__, "len": len(items), "hidden": max(0, len(items) - SHAPE_ITEMS),
                    "entries": [[sub(k), sub(v)] for k, v in items[:SHAPE_ITEMS]]}
        if base:
            items = list(base.__iter__(value))
            return {"kind": "seq", "id": number, "type": kind.__name__, "len": len(items), "hidden": max(0, len(items) - SHAPE_ITEMS),
                    "items": [sub(v) for v in items[:SHAPE_ITEMS]]}
        fields = self.fields(value)
        if fields is None:
            return {"kind": "opaque", "type": kind.__name__}
        return {"kind": "object", "id": number, "type": kind.__name__, "hidden": max(0, len(fields) - SHAPE_ITEMS),
                "fields": {k: sub(v) for k, v in fields[:SHAPE_ITEMS]}}

    @staticmethod
    def scalar(value):
        kind = type(value)
        if kind is float and (value != value or value in (float("inf"), float("-inf"))):
            return {"kind": "scalar", "type": "float", "value": repr(value), "tag": "float"}  # JSON has no nan or inf
        if kind is int and abs(value) > 2**53:
            return {"kind": "scalar", "type": "int", "value": str(value), "tag": "int"}  # JSON.parse would round it
        if kind is str and len(value) > MAX_TEXT:
            value = value[: MAX_TEXT - 1] + "…"
        return {"kind": "scalar", "type": kind.__name__, "value": value}

    @staticmethod
    def fields(value):
        found, slotted = [], False
        for cls in type(value).__mro__:
            slots = cls.__dict__.get("__slots__", ())
            slotted = slotted or "__slots__" in cls.__dict__
            for name in (slots,) if isinstance(slots, str) else slots:
                descriptor = cls.__dict__.get(name)
                if isinstance(descriptor, types.MemberDescriptorType):
                    try:
                        found.append((name, descriptor.__get__(value)))
                    except AttributeError:  # a slot that was never set
                        pass
        try:
            instance = object.__getattribute__(value, "__dict__")  # not getattr: a __getattr__ of the person's would run
        except AttributeError:
            instance = None
        if isinstance(instance, dict):
            found.extend(dict.items(instance))
        return found if slotted or isinstance(instance, dict) else None

    def snapshot(self, frame):
        """{local name: shape} for one visit, or None once the recording's byte budget is spent."""
        if self.full:
            return None
        seen, budget, shapes = set(), [SHAPE_NODES], {}
        for name, value in list(frame.f_locals.items()):
            if name.startswith("__"):
                continue
            shapes[name] = self.shape(value, seen, budget)
            text = json.dumps(shapes[name], separators=(",", ":"))
            if self.previous.get(name) != text:
                shapes[name]["changed"] = True
            self.previous[name] = text
            self.bytes += len(text)
        if self.bytes > SHAPE_BYTES:
            self.full = True
        return shapes


def resolve(module, parts, instance):
    """The function to call: a plain function, or a method of an instance built from the constructor arguments."""
    owner = module
    for name in parts[:-1]:
        owner = getattr(owner, name)
    if len(parts) > 1:
        owner = owner(*instance.get("args", []), **instance.get("kwargs", {}))
    return getattr(owner, parts[-1])


def literal(text):
    """The value of a Python literal text, or the reason it is not one. Text is parsed, never run."""
    try:
        return ast.literal_eval(text.strip()), None
    except (ValueError, SyntaxError, TypeError, MemoryError, RecursionError) as e:
        what = "is not valid Python" if isinstance(e, SyntaxError) else "is not a plain value (calls, names and expressions are not run)"
        return None, f"{text.strip()[:60]} {what}"


def evaluate_values(function, values, key="", method=False):
    """Turn {parameter: Python literal text} into call arguments. Only literals pass.
    Returns (args, kwargs, problems) where problems maps a field key (`key` + parameter name) to what is wrong.
    A method's first parameter (self) is not one the person fills in."""
    a = function.args
    positional = (a.posonlyargs + a.args)[1 if method else 0:]
    posonly = a.posonlyargs[1 if method else 0:]
    names = [x.arg for x in positional + a.kwonlyargs]
    problems, evaluated = {}, {}
    for name, text in values.items():
        if name not in names:
            problems[key + name] = f"{name} is not a parameter of this function"
        elif text.strip():  # a blank value leaves the default in place
            value, why = literal(text)
            if why:
                problems[key + name] = f"{name}: {why}"
            else:
                evaluated[name] = value
    args = []
    for x in posonly:  # these cannot be given by name, so they go first, in order
        if x.arg not in evaluated:
            break
        args.append(evaluated.pop(x.arg))
    return args, evaluated, problems


def main():
    root, module_id, qualified, file = sys.argv[1:5]
    root, file = os.path.abspath(root), os.path.abspath(file)  # the script changes folder below
    request = json.load(sys.stdin)
    args, kwargs = request.get("args", []), request.get("kwargs", {})
    instance, fakes = request.get("instance") or {}, request.get("fakes", {})

    flow = load_flow()
    try:
        with open(file, encoding="utf-8") as f:
            source = f.read()
        parts = qualified.split(".")
        tree = ast.parse(source)
        function = flow.find_function(tree, parts)
        graph = flow.flow_of(source, qualified)
    except (OSError, SyntaxError, ValueError, RecursionError):
        sys.exit(3)
    if function is None or graph is None:
        sys.exit(2)

    # ponytail: a generator reports a "return" at every yield and an async function runs inside an event loop;
    # neither fits one straight recording, so they are refused until there is a design for them.
    if isinstance(function, ast.AsyncFunctionDef) or any(isinstance(n, (ast.Yield, ast.YieldFrom)) for n in ast.walk(function)):
        json.dump({"unsupported": "Generators and async functions cannot be played yet"}, sys.stdout)
        return

    problems = {}
    if request.get("values"):
        args, kwargs, found = evaluate_values(function, request["values"], method=len(parts) > 1)
        problems.update(found)
    if request.get("instanceValues"):  # the constructor's values, for a method
        init = flow.find_function(tree, parts[:-1] + ["__init__"]) if len(parts) > 1 else None
        if init is None:
            problems["constructor"] = "This class has no constructor to give values to"
        else:
            instance_args, instance_kwargs, found = evaluate_values(init, request["instanceValues"], "constructor.", True)
            instance = {"args": instance_args, "kwargs": instance_kwargs}
            problems.update(found)
    for name, text in (request.get("effects") or {}).items():  # data for the effects, as literals
        value, why = literal(text)
        if why:
            problems[f"effect:{name}"] = f"{name}: {why}"
        else:
            fakes[name] = value
    if problems:
        json.dump({"invalid": problems}, sys.stdout)
        return

    found = effects_of(function, fakes, import_aliases(tree))
    if found:
        json.dump({"refused": found}, sys.stdout)
        return

    steps = graph["steps"]
    start_id, end_id = steps[0]["id"], steps[-1]["id"]
    first_line = {s["id"]: s["line"] for s in steps}
    by_line = {}
    for step in sorted(steps[1:-1], key=lambda s: s["endLine"] - s["line"], reverse=True):  # the narrowest step wins a line
        for line in range(step["line"], step["endLine"] + 1):
            by_line[line] = step["id"]

    sys.dont_write_bytecode = True
    os.chdir(root)
    sys.path.insert(0, root)
    # Reads are allowed inside the project and where Python and the project's packages live, so imports keep working.
    own_folder = os.path.dirname(os.path.abspath(__file__))
    readable = {root, sys.prefix, sys.base_prefix, sys.exec_prefix, sys.base_exec_prefix}
    readable |= {os.path.abspath(p) if p else root for p in sys.path if os.path.abspath(p or ".") != own_folder}
    readable |= {p for p in sysconfig.get_paths().values() if p}
    install_audit_hook(readable)

    trace, out, state = [], io.StringIO(), {"last": None, "result": None, "raising": False, "frame": None}
    recording = {"truncated": False}
    shaper = Shaper()

    def record(step, frame):
        if len(trace) >= MAX_STEPS:
            raise StopRecording()
        visit = {"step": step, "locals": snapshot(frame)}
        shapes = shaper.snapshot(frame)
        if shapes is not None:
            visit["shapes"] = shapes
        elif not recording.get("shapesTruncated"):
            recording["shapesTruncated"] = True  # the byte budget is spent: later visits keep their text only
        trace.append(visit)

    def local_trace(frame, event, arg):
        if event == "line":
            state["raising"] = False  # an exception that was caught inside the function ends here
            step = by_line.get(frame.f_lineno)
            if step and (step != state["last"] or frame.f_lineno == first_line[step]):
                state["last"] = step
                record(step, frame)
        elif event == "exception":
            state["raising"] = True
        elif event == "return" and not state["raising"]:
            # Python also reports a "return" while an exception leaves the function; that is not the end step.
            state["result"] = short(arg, 200)
            record(end_id, frame)
        return local_trace

    def run(target):
        code = inspect.unwrap(target)
        code = getattr(code, "__func__", code).__code__

        def global_trace(frame, event, arg):
            # Only the outermost call is recorded: a recursive call would interleave its steps with the first one.
            if frame.f_code is code and event == "call" and state["frame"] is None:
                state["frame"] = frame
                record(start_id, frame)
                return local_trace
            return None

        sys.settrace(global_trace)
        try:
            return target(*args, **kwargs)
        finally:
            sys.settrace(None)

    try:
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(out):
            module = importlib.import_module(module_id)
            for name, value in fakes.items():
                patch(module, name, value)
            run(resolve(module, parts, instance))
    except StopRecording:
        recording["truncated"] = True
    except Exception as e:  # the function (or the module around it) failed: that is part of the recording
        recording["error"] = {"type": type(e).__name__, "message": str(e)[:300]}

    result = {"output": out.getvalue()[:10000], "visits": trace, **recording}
    if "error" not in recording and not recording["truncated"]:
        result["result"] = state["result"]
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
