"""Print the arguments the Project's own tests pass to a function, as JSON.

Usage: examples.py <project folder> <file of the function> <qualified name>
Reads source with the standard library only; never imports or runs the project or its tests.

Only calls whose every argument is a plain literal are offered, each as the Python literal text per parameter name.
A call with any argument that cannot be read statically (a variable, a call, `*args`) offers nothing.
Plain functions only: a method's calls cannot be told from other objects' calls of the same name without running code.
"""
import ast
import json
import os
import sys

SKIP_DIRS = {"__pycache__", "venv", "env", "node_modules", "dist", "build", "site-packages"}
MAX_EXAMPLES = 10


def is_test_file(name):
    return name.endswith(".py") and (name.startswith("test_") or name.endswith("_test.py"))


def literal(node):
    try:
        ast.literal_eval(node)
        return ast.unparse(node)
    except Exception:
        return None


def main(root, file, qualified):
    if "." in qualified:
        return []
    with open(file, encoding="utf-8") as f:
        definition = next((s for s in ast.parse(f.read()).body if isinstance(s, (ast.FunctionDef, ast.AsyncFunctionDef)) and s.name == qualified), None)
    if definition is None:
        return []
    a = definition.args
    names = [p.arg for p in a.posonlyargs + a.args]
    found = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS and not d.startswith("."))
        for filename in sorted(filenames):
            if not is_test_file(filename):
                continue
            path = os.path.join(dirpath, filename)
            try:
                with open(path, encoding="utf-8") as f:
                    tree = ast.parse(f.read())
            except (OSError, SyntaxError, ValueError):
                continue
            for call in sorted((n for n in ast.walk(tree) if isinstance(n, ast.Call)), key=lambda n: n.lineno):
                callee = call.func.id if isinstance(call.func, ast.Name) else call.func.attr if isinstance(call.func, ast.Attribute) else None
                if callee != qualified:
                    continue
                pairs = list(zip(names, call.args)) + [(k.arg, k.value) for k in call.keywords]
                if len(call.args) > len(names) or any(isinstance(x, ast.Starred) for x in call.args) or any(k.arg is None for k in call.keywords):
                    continue
                values = {name: literal(value) for name, value in pairs}
                if None in values.values() or not values or not set(values) <= set(names + [p.arg for p in a.kwonlyargs]):
                    continue
                source = f"{os.path.relpath(path, root).replace(os.sep, '/')}:{call.lineno}"
                found.append({"source": source, "values": values})
    return found[:MAX_EXAMPLES]


if __name__ == "__main__":
    print(json.dumps(main(sys.argv[1], sys.argv[2], sys.argv[3])))
