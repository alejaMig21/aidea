"""Print the modules, classes and functions of a Python project as JSON.

Reads source with the standard library only; never imports or runs the project.
"""
import ast
import json
import os
import sys

SKIP_DIRS = {"__pycache__", "venv", "node_modules"}


def visit(body, parent, prefix, nodes):
    for stmt in body:
        if isinstance(stmt, ast.ClassDef):
            kind = "class"
        elif isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef)):
            kind = "function"
        else:
            continue
        node_id = f"{prefix}.{stmt.name}"
        nodes.append({"id": node_id, "kind": kind, "name": stmt.name, "parent": parent})
        # ponytail: nested functions are not listed, only classes and their members
        if kind == "class":
            visit(stmt.body, node_id, node_id, nodes)


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
                    tree = ast.parse(f.read(), filename=rel)
            except (SyntaxError, UnicodeDecodeError) as e:
                errors.append({"file": rel.replace(os.sep, "/"), "message": str(e)})
                continue
            nodes.append({"id": module, "kind": "module", "name": module, "parent": None})
            visit(tree.body, module, module, nodes)
    return {"nodes": nodes, "errors": errors}


if __name__ == "__main__":
    json.dump(analyze(sys.argv[1]), sys.stdout)
