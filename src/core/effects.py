"""Which calls touch the outside world. One list, shared by Playback (it fakes them) and the flow extractor (it draws them
as input and output). Names only: this never imports or runs the project."""
import ast

EFFECT_CALLS = {"open", "input", "exec", "eval", "__import__"}
EFFECT_ROOTS = {
    "os", "subprocess", "socket", "requests", "urllib", "http", "shutil", "sqlite3", "ftplib", "smtplib", "webbrowser",
    "tempfile", "glob", "ctypes", "_winapi", "multiprocessing",
}
EFFECT_METHODS = {"read_text", "write_text", "read_bytes", "write_bytes", "unlink", "mkdir", "rmdir", "touch", "rename"}
PURE_PREFIXES = ("os.path.join", "os.path.basename", "os.path.dirname", "os.path.splitext", "os.path.split", "os.path.normpath", "urllib.parse.")
READS = {"input", "read_text", "read_bytes", "get", "read", "recv", "urlopen", "listdir", "glob"}


def import_aliases(tree, nodes=None):
    """Names a module gives to what it imports: `import os as o` and `from os import remove as rm`.
    `nodes` is the tree already walked breadth first, when the caller did it (the order decides which of two imports of one name wins)."""
    aliases = {}
    for node in (nodes if nodes is not None else ast.walk(tree)):
        if isinstance(node, ast.Import):
            for a in node.names:
                aliases[(a.asname or a.name).split(".")[0]] = a.name if a.asname else a.name.split(".")[0]
        elif isinstance(node, ast.ImportFrom) and node.module:
            for a in node.names:
                aliases[a.asname or a.name] = f"{node.module}.{a.name}"
    return aliases


def resolve_alias(name, aliases):
    first, dot, rest = name.partition(".")
    return aliases[first] + dot + rest if first in aliases else name


def is_effect(resolved):
    """True when a call, written with its imports resolved (`os.remove`), reads or writes the outside world."""
    if resolved.startswith(PURE_PREFIXES):
        return False
    root, last = resolved.split(".")[0], resolved.rsplit(".", 1)[-1]
    return resolved in EFFECT_CALLS or ("." in resolved and (root in EFFECT_ROOTS or last in EFFECT_METHODS))


def io_of(call, aliases):
    """'input', 'output' or None for one ast.Call: the known effects plus print (which is output)."""
    resolved = resolve_alias(ast.unparse(call.func), aliases)
    if resolved == "print":
        return "output"
    if not is_effect(resolved) or resolved in ("exec", "eval", "__import__"):  # Playback fakes these; they are not input or output
        return None
    if resolved == "open":  # opening for writing is output; the default mode reads
        mode = call.args[1] if len(call.args) > 1 else next((k.value for k in call.keywords if k.arg == "mode"), None)
        return "output" if isinstance(mode, ast.Constant) and any(c in str(mode.value) for c in "wax+") else "input"
    return "input" if resolved.rsplit(".", 1)[-1] in READS else "output"
