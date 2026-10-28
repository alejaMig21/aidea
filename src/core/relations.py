"""Relationships between the Nodes of a Python project: inheritance, imports and calls.

Reads syntax trees only; never imports or runs the project. Each relationship says how sure it is (its Resolution):
  resolved   the target is certain: a direct call to a Project function, an import of a Project module, a base class
             defined in the Project, or a base certainly outside it (`external`);
  inferred   matched by name only, for example `obj.area()` when several classes define `area` (one entry per candidate);
  unresolved dynamic dispatch, `getattr`, calls through variables or parameters, `import_module` with a computed name.
Nothing the analysis cannot follow is dropped: it is reported as unresolved. Calls to code outside the Project
(builtins, libraries) are not relationships of the Project and are left out, as are imports of outside modules.
"""
import ast
import builtins

FUNCTIONS = (ast.FunctionDef, ast.AsyncFunctionDef)


def dotted(expr):
    """`a.b.c` as a list of names, or None when the expression is anything else."""
    parts = []
    while isinstance(expr, ast.Attribute):
        parts.append(expr.attr)
        expr = expr.value
    if not isinstance(expr, ast.Name):
        return None
    return [expr.id] + parts[::-1]


def calls_in(stmts, into_defs):
    """Every call in the statements; with `into_defs` false, function and class bodies are left to their own Nodes."""
    stack = list(stmts)
    while stack:
        n = stack.pop()
        if not into_defs and isinstance(n, FUNCTIONS + (ast.ClassDef,)):
            continue
        if isinstance(n, ast.Call):
            yield n
        stack.extend(ast.iter_child_nodes(n))


def find(nodes, trees, defs):
    by_id = {n["id"]: n for n in nodes}
    modules = {n["id"] for n in nodes if n["kind"] == "module"}
    rels, seen = [], set()

    def module_of(node_id):
        n = by_id[node_id]
        while n["parent"]:
            n = by_id[n["parent"]]
        return n["id"]

    def find_module(name):
        return name if name in modules else f"{name}.__init__" if f"{name}.__init__" in modules else None

    def add(kind, source, to, name, resolution, line, **extra):
        key = (kind, source, to, name, resolution, line if resolution == "unresolved" else 0, tuple(extra.get("names", ())))
        if key not in seen:
            seen.add(key)
            rels.append({"kind": kind, "from": source, "to": to, "name": name, "resolution": resolution, "line": line, **extra})

    # What each name means in each module: ("node", id) | ("module", module id) | ("external",) | ("unknown",).
    scopes = {m: {} for m in modules}
    for n in nodes:
        if n["parent"] in modules:
            scopes[n["parent"]][n["name"]] = ("node", n["id"])
    for module, (tree, _) in trees.items():
        scope = scopes[module]
        package = module.rsplit(".", 1)[0] if "." in module else ""
        if module.endswith(".__init__"):
            package = module[: -len(".__init__")]
        for stmt in ast.walk(tree):
            if isinstance(stmt, ast.Import):
                for alias in stmt.names:
                    bound = alias.name if alias.asname else alias.name.split(".")[0]
                    mid = find_module(bound)
                    scope[alias.asname or bound] = ("module", bound) if mid else ("external",)
                    target = find_module(alias.name)
                    if target:
                        add("imports", module, target, alias.name, "resolved", stmt.lineno)
            elif isinstance(stmt, ast.ImportFrom):
                base = stmt.module or ""
                if stmt.level:
                    parts = package.split(".") if package else []
                    parts = parts[: len(parts) - (stmt.level - 1)] if stmt.level > 1 else parts
                    base = ".".join(parts + ([stmt.module] if stmt.module else []))
                mid = find_module(base)
                names, modules_hit = [], []
                for alias in stmt.names:
                    bound = alias.asname or alias.name
                    if not mid:
                        if alias.name != "*":
                            scope[bound] = ("external",)
                        continue
                    if alias.name == "*":
                        names.append("*")
                        for n in nodes:
                            if n["parent"] == mid:
                                scope.setdefault(n["name"], ("node", n["id"]))
                    elif f"{mid}.{alias.name}" in by_id:
                        scope[bound] = ("node", f"{mid}.{alias.name}")
                        names.append(alias.name)
                    elif find_module(f"{base}.{alias.name}"):
                        scope[bound] = ("module", f"{base}.{alias.name}")
                        modules_hit.append(f"{base}.{alias.name}")
                    else:  # a name the module re-exports or computes: the analysis cannot tell what it is
                        scope[bound] = ("unknown",)
                        names.append(alias.name)
                if mid and (names or not modules_hit):
                    add("imports", module, mid, base, "resolved", stmt.lineno, **({"names": names} if names else {}))
                for hit in modules_hit:
                    add("imports", module, find_module(hit), hit, "resolved", stmt.lineno)

    # Classes: their methods, and their bases found in the Project (inheritance is reported here too).
    methods = {n["id"]: {} for n in nodes if n["kind"] == "class"}
    method_index = {}
    for n in nodes:
        if n["kind"] == "function" and n["parent"] in methods:
            methods[n["parent"]][n["name"]] = n["id"]
            method_index.setdefault(n["name"], []).append(n["id"])
    bases = {c: [] for c in methods}
    for cid in methods:
        cls, _ = defs[cid]
        module = module_of(cid)
        scope = scopes[module]
        for b in cls.bases:
            expr = b.value if isinstance(b, ast.Subscript) else b  # Generic[T] is a base named Generic
            parts = dotted(expr)
            written = ".".join(parts) if parts else ast.unparse(expr)
            target, external = None, False
            if parts and len(parts) == 1:
                e = scope.get(parts[0])
                if e and e[0] == "node" and by_id[e[1]]["kind"] == "class":
                    target = e[1]
                elif e and e[0] == "external" or (e is None and hasattr(builtins, parts[0])):
                    external = True
            elif parts:
                e = scope.get(parts[0])
                if e and e[0] == "module":
                    mid = find_module(".".join([e[1]] + parts[1:-1]))
                    if mid and f"{mid}.{parts[-1]}" in by_id and by_id[f"{mid}.{parts[-1]}"]["kind"] == "class":
                        target = f"{mid}.{parts[-1]}"
                elif e and e[0] == "external":
                    external = True
            line = b.lineno
            if target:
                bases[cid].append(target)
                add("inherits", cid, target, written, "resolved", line)
            elif external:
                add("inherits", cid, None, written, "resolved", line, external=True)
            else:
                add("inherits", cid, None, written, "unresolved", line)

    def chain(cid, seen_classes=()):
        """The Project ancestors of a class, nearest first."""
        out = []
        for b in bases.get(cid, []):
            if b not in seen_classes:
                out += [b] + chain(b, seen_classes + (b,))
        return out

    def target_of(node_id):
        """A call to a class runs its constructor when the class has one."""
        if by_id[node_id]["kind"] == "class":
            return methods[node_id].get("__init__", node_id)
        return node_id

    def method_lookup(cid, name):
        if name in methods[cid]:
            return [(methods[cid][name], "resolved")]
        for a in chain(cid):
            if name in methods[a]:
                return [(methods[a][name], "inferred")]  # a subclass may override it
        return []

    def by_name(name):
        return [(m, "inferred") for m in method_index.get(name, [])]

    def resolve(func, ctx):
        """The (target, name, resolution) triples for the callee expression; empty when it is not about the Project."""
        scope, local, nested, modvars, owner, self_name = ctx
        if isinstance(func, ast.Name):
            n = func.id
            if n in nested:  # ponytail: nested functions are not Nodes; a call to one stays inside its enclosing function
                return []
            if n in local:
                return [(None, n, "unresolved")]
            e = scope.get(n)
            if e:
                if e[0] == "node":
                    return [(target_of(e[1]), n, "resolved")]
                return [(None, n, "unresolved")] if e[0] == "unknown" else []
            return [(None, n, "unresolved")] if n in modvars else []
        if isinstance(func, ast.Attribute):
            m, value = func.attr, func.value
            if owner and isinstance(value, ast.Name) and value.id == self_name:
                return [(t, m, r) for t, r in (method_lookup(owner, m) or by_name(m))]
            if owner and isinstance(value, ast.Call) and isinstance(value.func, ast.Name) and value.func.id == "super":
                return next(([(methods[a][m], m, "inferred")] for a in chain(owner) if m in methods[a]), [])
            parts = dotted(value)
            if parts and parts[0] not in local:
                e = scope.get(parts[0])
                if e and e[0] == "external":
                    return []
                if e and e[0] == "node" and len(parts) == 1 and by_id[e[1]]["kind"] == "class":
                    return [(t, m, r) for t, r in (method_lookup(e[1], m) or by_name(m))]
                if e and e[0] == "module":
                    rest = parts[1:]
                    for k in range(len(rest), -1, -1):
                        mid = find_module(".".join([e[1]] + rest[:k]))
                        if not mid:
                            continue
                        left = rest[k:]
                        if not left:
                            node = f"{mid}.{m}"
                            return [(target_of(node), m, "resolved")] if node in by_id else [(None, m, "unresolved")]
                        cls = f"{mid}.{left[0]}"
                        if len(left) == 1 and cls in methods:
                            return [(t, m, r) for t, r in (method_lookup(cls, m) or by_name(m))]
                        break
                    return [(None, m, "unresolved")]
            return [(t, m, r) for t, r in by_name(m)]
        if isinstance(func, ast.Call):  # f()(): getattr(obj, name)(), factories
            inner = dotted(func.func)
            return [(None, ".".join(inner) if inner else "call", "unresolved")]
        if isinstance(func, ast.Subscript):  # handlers[key]()
            return [(None, ast.unparse(func.value) + "[]", "unresolved")]
        return []

    def report(source, line_calls, ctx):
        for call in line_calls:
            callee = dotted(call.func) or []
            if callee and callee[-1] in ("import_module", "__import__"):  # a dynamic import
                arg = call.args[0] if call.args else None
                mid = find_module(arg.value) if isinstance(arg, ast.Constant) and isinstance(arg.value, str) else None
                if mid:
                    add("imports", source, mid, arg.value, "resolved", call.lineno)
                else:
                    add("imports", source, None, callee[-1], "unresolved", call.lineno)
                continue
            for to, name, resolution in resolve(call.func, ctx):
                add("calls", source, to, name, resolution, call.lineno)

    modvars = {}
    for module, (tree, _) in trees.items():
        scope = scopes[module]
        stores = {n.id for s in tree.body if not isinstance(s, FUNCTIONS + (ast.ClassDef,)) for n in ast.walk(s)
                  if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store)}
        modvars[module] = stores - scope.keys()
        report(module, calls_in(tree.body, False), (scope, set(), set(), modvars[module], None, None))
    for fid, (stmt, owner) in defs.items():
        if by_id[fid]["kind"] != "function":
            continue
        module = module_of(fid)
        walk = [n for s in stmt.body for n in ast.walk(s)]
        local = {n.arg for n in walk if isinstance(n, ast.arg)} | {a.arg for a in ast.walk(stmt.args) if isinstance(a, ast.arg)} \
            | {n.id for n in walk if isinstance(n, ast.Name) and isinstance(n.ctx, ast.Store)}
        nested = {n.name for n in walk if isinstance(n, FUNCTIONS + (ast.ClassDef,))}
        positional = stmt.args.posonlyargs + stmt.args.args
        self_name = positional[0].arg if owner is not None and positional and not by_id[fid]["markers"].get("static") else None
        ctx = (scopes[module], local, nested, modvars[module], by_id[fid]["parent"] if owner is not None else None, self_name)
        report(fid, calls_in(stmt.body, True), ctx)

    rels.sort(key=lambda r: (r["from"], r["kind"], r["line"], r["name"], r["to"] or ""))
    return rels
