"""Print the control-flow graph of one Python function as JSON.

Usage: flow.py <file> <qualified name, such as Scorer.classify>
Reads source with the standard library only; never imports or runs the project.

Steps are the nodes (start, step, branch, loop, return, raise, end); edges say how control moves.
An edge that returns to an earlier step (the end of a loop body going back to the loop) has "back": true.
"""
import ast
import json
import sys
import textwrap


def names_in(parts, also_read=()):
    """Names read and written by the given AST parts, as sorted lists."""
    reads, writes = set(also_read), set()
    for part in parts:
        for n in ast.walk(part):
            if isinstance(n, ast.Name):
                (writes if isinstance(n.ctx, ast.Store) else reads).add(n.id)
            elif isinstance(n, ast.Attribute) and isinstance(n.ctx, ast.Store):
                writes.add(ast.unparse(n))
    return sorted(reads), sorted(writes)


class Flow:
    def __init__(self, lines):
        self.lines = lines
        self.steps = []
        self.edges = []
        self.exits = []  # return and raise steps: they go straight to the end

    def add(self, kind, label, line, end_line, parts=(), also_read=(), writes=None):
        reads, written = names_in(parts, also_read)
        step = {
            "id": f"n{len(self.steps)}",
            "kind": kind,
            "label": label if len(label) <= 60 else label[:59] + "…",
            "text": textwrap.dedent("\n".join(self.lines[line - 1:end_line])),
            "line": line,
            "endLine": end_line,
            "reads": reads,
            "writes": sorted(writes) if writes is not None else written,
        }
        self.steps.append(step)
        return step["id"]

    def link(self, pending, target, back=False):
        for source, label in pending:
            edge = {"from": source, "to": target}
            if label:
                edge["label"] = label
            if back:
                edge["back"] = True
            self.edges.append(edge)

    def block(self, stmts, pending, loop):
        for stmt in stmts:
            pending = self.statement(stmt, pending, loop)
        return pending

    def header(self, stmt):
        """First and last line of a compound statement's own line(s), without its body."""
        return stmt.lineno, max(stmt.lineno, stmt.body[0].lineno - 1)

    def statement(self, stmt, pending, loop):
        if isinstance(stmt, ast.If):
            first, last = self.header(stmt)
            node = self.add("branch", f"if {ast.unparse(stmt.test)}", first, last, [stmt.test])
            self.link(pending, node)
            body_ends = self.block(stmt.body, [(node, "true")], loop)
            else_ends = self.block(stmt.orelse, [(node, "false")], loop) if stmt.orelse else [(node, "false")]
            return body_ends + else_ends

        if isinstance(stmt, (ast.For, ast.AsyncFor, ast.While)):
            first, last = self.header(stmt)
            if isinstance(stmt, ast.While):
                node = self.add("loop", f"while {ast.unparse(stmt.test)}", first, last, [stmt.test])
            else:
                label = f"for {ast.unparse(stmt.target)} in {ast.unparse(stmt.iter)}"
                node = self.add("loop", label, first, last, [stmt.target, stmt.iter])
            self.link(pending, node)
            inner = {"node": node, "breaks": []}
            body_ends = self.block(stmt.body, [(node, "true")], inner)
            self.link(body_ends, node, back=True)
            after = self.block(stmt.orelse, [(node, "false")], loop) if stmt.orelse else [(node, "false")]
            return after + inner["breaks"]

        if isinstance(stmt, (ast.With, ast.AsyncWith)):
            first, last = self.header(stmt)
            label = "with " + ", ".join(ast.unparse(i.context_expr) for i in stmt.items)
            node = self.add("step", label, first, last, [i for i in stmt.items])
            self.link(pending, node)
            return self.block(stmt.body, [(node, None)], loop)

        if isinstance(stmt, ast.Try):
            first, last = self.header(stmt)
            node = self.add("step", "try", first, last)
            self.link(pending, node)
            ends = self.block(stmt.body, [(node, None)], loop)
            if stmt.orelse:
                ends = self.block(stmt.orelse, ends, loop)
            for handler in stmt.handlers:
                label = "except" + (f" {ast.unparse(handler.type)}" if handler.type else "")
                h_first, h_last = self.header(handler)
                hnode = self.add("step", label, h_first, h_last, [handler.type] if handler.type else [])
                self.link([(node, "error")], hnode)
                ends += self.block(handler.body, [(hnode, None)], loop)
            # ponytail: an exception can come from any line of the try body; it is drawn from the `try` step only
            return self.block(stmt.finalbody, ends, loop) if stmt.finalbody else ends

        if isinstance(stmt, ast.Match):
            node = self.add("branch", f"match {ast.unparse(stmt.subject)}", stmt.lineno, stmt.lineno, [stmt.subject])
            self.link(pending, node)
            # The cases are tried in order: a case that does not match leads to the next one.
            ends, previous = [], [(node, None)]
            for case in stmt.cases:
                label = f"case {ast.unparse(case.pattern)}" + (f" if {ast.unparse(case.guard)}" if case.guard else "")
                first = case.pattern.lineno
                parts = [case.pattern] + ([case.guard] if case.guard else [])
                case_node = self.add("branch", label, first, max(first, case.body[0].lineno - 1), parts)
                self.link(previous, case_node)
                ends += self.block(case.body, [(case_node, "true")], loop)
                previous = [(case_node, "false")]
            last = stmt.cases[-1]
            catch_all = isinstance(last.pattern, ast.MatchAs) and last.pattern.pattern is None and last.guard is None
            return ends if catch_all else ends + previous

        if isinstance(stmt, (ast.Return, ast.Raise)):
            kind = "return" if isinstance(stmt, ast.Return) else "raise"
            node = self.add(kind, ast.unparse(stmt).split("\n")[0], stmt.lineno, stmt.end_lineno, [stmt])
            self.link(pending, node)
            self.exits.append(node)
            return []

        if isinstance(stmt, ast.Break) and loop:
            node = self.add("step", "break", stmt.lineno, stmt.end_lineno)
            self.link(pending, node)
            loop["breaks"].append((node, None))
            return []

        if isinstance(stmt, ast.Continue) and loop:
            node = self.add("step", "continue", stmt.lineno, stmt.end_lineno)
            self.link(pending, node)
            self.link([(node, None)], loop["node"], back=True)
            return []

        if isinstance(stmt, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            kind = "class" if isinstance(stmt, ast.ClassDef) else "def"
            # ponytail: a nested definition is one step; its own flow is not expanded
            node = self.add("step", f"{kind} {stmt.name}", stmt.lineno, stmt.lineno, writes=[stmt.name])
            self.link(pending, node)
            return [(node, None)]

        # Any other statement is a single step. An augmented assignment also reads what it writes.
        also_read = [ast.unparse(stmt.target)] if isinstance(stmt, ast.AugAssign) else []
        node = self.add("step", ast.unparse(stmt).split("\n")[0], stmt.lineno, stmt.end_lineno, [stmt], also_read)
        self.link(pending, node)
        return [(node, None)]


def find_function(tree, parts):
    body, found = tree.body, None
    for name in parts:
        found = next(
            (s for s in body if isinstance(s, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and s.name == name),
            None,
        )
        if found is None:
            return None
        body = found.body
    return found if isinstance(found, (ast.FunctionDef, ast.AsyncFunctionDef)) else None


def flow_of(source, qualified_name):
    function = find_function(ast.parse(source), qualified_name.split("."))
    if function is None:
        return None
    flow = Flow(source.splitlines())
    params = [a.arg for a in function.args.posonlyargs + function.args.args + function.args.kwonlyargs]
    for extra in (function.args.vararg, function.args.kwarg):
        if extra:
            params.append(extra.arg)
    start = flow.add(
        "start", f"{function.name}({ast.unparse(function.args)})",
        function.lineno, max(function.lineno, function.body[0].lineno - 1), writes=params,
    )
    pending = flow.block(function.body, [(start, None)], None)
    end = flow.add("end", "end", function.end_lineno, function.end_lineno, writes=[])
    flow.link(pending + [(node, None) for node in flow.exits], end)
    return {"steps": flow.steps, "edges": flow.edges}


if __name__ == "__main__":
    # Exit codes: 2 = the function is not in the file; 3 = the file cannot be read as Python.
    try:
        with open(sys.argv[1], encoding="utf-8") as f:
            result = flow_of(f.read(), sys.argv[2])
    except (OSError, SyntaxError, ValueError, RecursionError):
        print(json.dumps({"error": "file cannot be read as Python"}))
        sys.exit(3)
    if result is None:
        print(json.dumps({"error": "function not found"}))
        sys.exit(2)
    json.dump(result, sys.stdout)
