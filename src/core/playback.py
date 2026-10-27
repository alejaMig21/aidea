"""Run one Python function under a tracer and print what happened as JSON.

Usage: playback.py <project folder> <module id> <qualified name> <file>
Standard input: {"args": [...], "kwargs": {...}, "instance": {"args": [...], "kwargs": {...}} or null, "fakes": {name: value}}
Standard output: {"refused": [{"name", "line"}]} when the function has external effects that are not replaced, or
  {"result", "output", "trace": [{"step", "locals"}], "truncated", "error"?} after running it.
Exit codes: 2 = the function is not in the file; 3 = the file cannot be read as Python.

The inputs are JSON values, never code. Two guards protect against accidental effects:
  1. before running, calls that read or write the outside world (files, network, processes) are refused unless the
     person replaced them with fake data;
  2. while running, an audit hook stops file writes, network access and new processes, even when they are hidden
     inside a helper. This is a safety net for mistakes, not a sandbox against code written to escape it.
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

MAX_STEPS = 2000  # a run that records more steps than this is cut short (for example an endless loop)
MAX_TEXT = 80

EFFECT_CALLS = {"open", "input", "exec", "eval", "__import__"}
EFFECT_ROOTS = {"os", "subprocess", "socket", "requests", "urllib", "http", "shutil", "sqlite3", "ftplib", "smtplib", "webbrowser", "tempfile", "glob"}
EFFECT_METHODS = {"read_text", "write_text", "read_bytes", "write_bytes", "unlink", "mkdir", "rmdir", "touch", "rename"}
PURE_PREFIXES = ("os.path.join", "os.path.basename", "os.path.dirname", "os.path.splitext", "os.path.split", "os.path.normpath", "urllib.parse.")
BLOCKED_EVENTS = {
    "socket.connect", "socket.bind", "socket.sendto", "socket.getaddrinfo", "subprocess.Popen", "os.system", "os.exec",
    "os.posix_spawn", "os.spawn", "os.remove", "os.rename", "os.rmdir", "os.mkdir", "os.chmod", "os.truncate",
    "os.putenv", "os.startfile", "shutil.copyfile", "shutil.rmtree", "shutil.move", "shutil.copytree", "urllib.Request",
    "http.client.connect", "smtplib.connect", "ftplib.connect", "sqlite3.connect", "webbrowser.open",
}


class StopRecording(BaseException):
    """Raised from the tracer to cut a run short. Not an Exception, so the function's own `except` cannot hide it."""


def load_flow():
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location("_aidea_flow", os.path.join(here, "flow.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def effects_of(function, fakes):
    """Calls in the function's own body that touch the outside world and are not replaced."""
    found = []
    for node in ast.walk(function):
        if not isinstance(node, ast.Call):
            continue
        name = ast.unparse(node.func)
        if name in fakes or name.startswith(PURE_PREFIXES):
            continue
        root, last = name.split(".")[0], name.rsplit(".", 1)[-1]
        if name in EFFECT_CALLS or ("." in name and (root in EFFECT_ROOTS or last in EFFECT_METHODS)):
            found.append({"name": name, "line": node.lineno})
    return sorted(found, key=lambda e: (e["line"], e["name"]))


def install_audit_hook():
    write_flags = os.O_WRONLY | os.O_RDWR | os.O_APPEND | os.O_CREAT | os.O_TRUNC

    def hook(event, args):
        if event == "open":
            _, mode, flags = args
            if (isinstance(mode, str) and any(c in mode for c in "wax+")) or (isinstance(flags, int) and flags & write_flags):
                raise PermissionError("blocked by aidea: writing a file")
        elif event in BLOCKED_EVENTS:
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


def resolve(module, parts, instance):
    """The function to call: a plain function, or a method of an instance built from the constructor arguments."""
    owner = module
    for name in parts[:-1]:
        owner = getattr(owner, name)
    if len(parts) > 1:
        owner = owner(*instance.get("args", []), **instance.get("kwargs", {}))
    return getattr(owner, parts[-1])


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
        function = flow.find_function(ast.parse(source), parts)
        graph = flow.flow_of(source, qualified)
    except (OSError, SyntaxError, ValueError, RecursionError):
        sys.exit(3)
    if function is None or graph is None:
        sys.exit(2)

    found = effects_of(function, fakes)
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
    install_audit_hook()

    trace, out, state = [], io.StringIO(), {"last": None, "result": None, "raising": False}
    recording = {"truncated": False}

    def record(step, frame):
        if len(trace) >= MAX_STEPS:
            raise StopRecording()
        trace.append({"step": step, "locals": snapshot(frame)})

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
            if frame.f_code is code and event == "call":
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

    result = {"output": out.getvalue()[:10000], "trace": trace, **recording}
    if "error" not in recording and not recording["truncated"]:
        result["result"] = state["result"]
    json.dump(result, sys.stdout)


if __name__ == "__main__":
    main()
