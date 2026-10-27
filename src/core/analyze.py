"""Print the modules, classes and functions of a Python project as JSON.

Reads source with the standard library only; never imports or runs the project.
"""
import ast
import json
import os
import sys

SKIP_DIRS = {"__pycache__", "venv", "node_modules"}


def attributes(cls):
    """Class-level assignments, then `self.x` assignments in `__init__`, first occurrence wins."""
    found = {}

    def add(target, line, self_only):
        if self_only:
            ok = isinstance(target, ast.Attribute) and isinstance(target.value, ast.Name) and target.value.id == "self"
            name = target.attr if ok else None
        else:
            name = target.id if isinstance(target, ast.Name) else None
        if name:
            found.setdefault(name, line)

    def scan(stmts, self_only):
        for s in stmts:
            if isinstance(s, ast.Assign):
                for t in s.targets:
                    add(t, s.lineno, self_only)
            elif isinstance(s, ast.AnnAssign):
                add(s.target, s.lineno, self_only)

    scan(cls.body, False)
    for s in cls.body:
        if isinstance(s, (ast.FunctionDef, ast.AsyncFunctionDef)) and s.name == "__init__":
            scan(s.body, True)
    return [{"name": n, "line": l} for n, l in found.items()]


def visit(body, parent, prefix, nodes, file):
    for stmt in body:
        if isinstance(stmt, ast.ClassDef):
            kind = "class"
        elif isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef)):
            kind = "function"
        else:
            continue
        node_id = f"{prefix}.{stmt.name}"
        first = min([d.lineno for d in stmt.decorator_list] + [stmt.lineno])
        node = {"id": node_id, "kind": kind, "name": stmt.name, "parent": parent,
                "file": file, "line": first, "endLine": stmt.end_lineno}
        if kind == "class":
            node["attributes"] = attributes(stmt)
        nodes.append(node)
        # ponytail: nested functions are not listed, only classes and their members
        if kind == "class":
            visit(stmt.body, node_id, node_id, nodes, file)


def analyze(root):
    nodes, errors = [], []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for filename in sorted(filenames):
            if not filename.endswith(".py"):
                continue
            path = os.path.join(dirpath, filename)
            rel = os.path.relpath(path, root)
            module = rel[:-3].replace(os.sep, ".")
            try:
                with open(path, encoding="utf-8") as f:
                    text = f.read()
                tree = ast.parse(text, filename=rel)
            except (SyntaxError, UnicodeDecodeError) as e:
                errors.append({"file": rel.replace(os.sep, "/"), "message": str(e)})
                continue
            file = rel.replace(os.sep, "/")
            end = max(len(text.splitlines()), 1)
            nodes.append({"id": module, "kind": "module", "name": module, "parent": None,
                          "file": file, "line": 1, "endLine": end})
            visit(tree.body, module, module, nodes, file)
    return {"nodes": nodes, "errors": errors}


if __name__ == "__main__":
    json.dump(analyze(sys.argv[1]), sys.stdout)
