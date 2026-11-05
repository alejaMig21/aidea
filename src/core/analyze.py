"""Print the modules, classes and functions of a Python project as JSON.

Reads source with the standard library only; never imports or runs the project.
"""
import ast
import json
import os
import sys

import playback  # sits next to this file; importing it runs nothing
import relations  # likewise

# Folders that hold copies of code (build output, installers) or libraries (virtual environments), not the project's own code. Hidden folders are skipped too.
SKIP_DIRS = {"__pycache__", "venv", "env", "node_modules", "dist", "build", "site-packages"}


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


# A small plain example per basic annotation, written as a Python literal.
EXAMPLES = {"int": "1", "float": "1.5", "str": '"text"', "bool": "True", "list": "[1, 2, 3]", "dict": '{"key": "value"}',
            "tuple": "(1, 2)", "set": "{1, 2}"}


def suggestion(default, annotation):
    """An example value: the default when it is a plain literal, else a basic annotation's example, else none."""
    if default is not None:
        try:
            ast.literal_eval(default)
            return ast.unparse(default)
        except Exception:  # not a plain literal
            pass
    if annotation is not None:
        return EXAMPLES.get(ast.unparse(annotation).split("[")[0])
    return None


def parameters(function, method=False):
    """Named parameters in call order with default and annotation text; `*args` and `**kwargs` are left out.
    A method's first parameter (self) is left out too."""
    a = function.args
    positional = a.posonlyargs + a.args
    skip = 1 if method and positional else 0
    defaults = [None] * (len(positional) - len(a.defaults)) + a.defaults + a.kw_defaults
    found = []
    for arg, default in list(zip(positional + a.kwonlyargs, defaults))[skip:]:
        item = {"name": arg.arg}
        if default is not None:
            item["default"] = ast.unparse(default)
        if arg.annotation is not None:
            item["annotation"] = ast.unparse(arg.annotation)
        example = suggestion(default, arg.annotation)
        if example is not None:
            item["suggestion"] = example
        found.append(item)
    return found


# A sample for the data an external call would give back, written as a Python literal.
EFFECT_SAMPLES = {"open": '"line one\\nline two"'}
DEFAULT_EFFECT_SAMPLE = '{"status": 200}'


def effects(function, aliases, flat):
    """External calls in the function (its body, decorators, defaults and annotations), each with a sample of the data to fake it with.
    `flat` is the function's body already walked, so the tree is not walked again."""
    rest = [*function.decorator_list, function.args, *([function.returns] if function.returns else []), *getattr(function, "type_params", [])]
    nodes = flat + [n for part in rest for n in relations.walk(part)]
    names = sorted({e["name"] for e in playback.effects_of(function, {}, aliases, nodes)})
    return [{"name": n, "suggestion": EFFECT_SAMPLES.get(n, DEFAULT_EFFECT_SAMPLE)} for n in names]


def decorator_names(stmt):
    """Last name of each decorator: `abc.abstractmethod` and `abstractmethod` both give `abstractmethod`."""
    names = []
    for d in stmt.decorator_list:
        d = d.func if isinstance(d, ast.Call) else d
        names.append(d.attr if isinstance(d, ast.Attribute) else d.id if isinstance(d, ast.Name) else "")
    return names


def visibility(name):
    if name.startswith("__") and name.endswith("__"):
        return "special"
    return "private" if name.startswith("_") else "public"


def markers(stmt, kind):
    """Visibility from the name; static, abstract and property from decorators (abstract classes: see `mark_abstract_classes`)."""
    found = {"visibility": visibility(stmt.name)}
    if kind == "function":
        decorators = decorator_names(stmt)
        if "staticmethod" in decorators:
            found["static"] = True
        if "abstractmethod" in decorators:
            found["abstract"] = True
        if "property" in decorators or "cached_property" in decorators or {"setter", "getter", "deleter"} & set(decorators):
            found["property"] = True
    return found


def has_abc_base(cls):
    """Derives `ABC` or names `ABCMeta` as its metaclass."""
    bases = [b for b in cls.bases] + [k.value for k in cls.keywords if k.arg == "metaclass"]
    return any(ast.unparse(b).split(".")[-1] in ("ABC", "ABCMeta") for b in bases)


def visit(body, parent, prefix, nodes, file, aliases, owner=None, defs=None, flats=None):
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
        if kind == "function":
            node["parameters"] = parameters(stmt, owner is not None)
            if owner is not None:  # the instance is built from the constructor's parameters
                init = next((s for s in owner.body if isinstance(s, (ast.FunctionDef, ast.AsyncFunctionDef)) and s.name == "__init__"), None)
                node["constructorParameters"] = parameters(init, True) if init else []
            flat = relations.flatten(stmt.body)
            if flats is not None:
                flats[node_id] = flat
            found = effects(stmt, aliases, flat)
            if found:
                node["effects"] = found
        node["markers"] = markers(stmt, kind)
        if kind == "class":
            node["attributeVisibility"] = {a["name"]: visibility(a["name"]) for a in node["attributes"]}
            if has_abc_base(stmt) or any(isinstance(m, (ast.FunctionDef, ast.AsyncFunctionDef)) and "abstractmethod" in decorator_names(m) for m in stmt.body):
                node["markers"]["abstract"] = True
        if defs is not None:
            defs[node_id] = (stmt, owner)
        nodes.append(node)
        # ponytail: nested functions are not listed, only classes and their members
        if kind == "class":
            visit(stmt.body, node_id, node_id, nodes, file, aliases, stmt, defs, flats)


def analyze(root):
    nodes, errors, trees, defs, flats, walks = [], [], {}, {}, {}, {}
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
            trees[module] = (tree, file)
            walks[module] = relations.walk(tree)  # one walk of the whole tree, used for the imports here and in the relationships
            visit(tree.body, module, module, nodes, file, playback.import_aliases(tree, walks[module]), None, defs, flats)
    relationships = relations.find(nodes, trees, defs, flats, walks)
    return {"nodes": nodes, "errors": errors, "relationships": relationships,
            "unresolved": sum(r["resolution"] == "unresolved" for r in relationships)}


if __name__ == "__main__":
    sys.stdout.write(json.dumps(analyze(sys.argv[1])))  # dumps uses the C encoder; dump streams through the slow Python one
