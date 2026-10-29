// The flow graph of one TypeScript or JavaScript function, in the shapes flow.py gives for Python (see its header and
// adapters.ts): steps (start, step, branch, loop, return, raise, end) and edges that say how control moves. The drawing,
// the legend and the narration read these shapes and know no language, so the constructs are named as flow.py names them:
// if, for (for...of and for...in), while (while, do...while and the classic for), match / case (switch), try, except (catch),
// break, continue, assign, call, and the generic ones with no symbol (lambda, yield, await, def, class...).
//
// The file is read with the TypeScript compiler's API (as typescript-adapter.ts does); nothing of the Project is run.
// ponytail: an exception is drawn from the `try` step only; a labelled break or continue is one plain step; `default` is
// tried last whatever its place in the switch; a return or throw inside try goes straight to the end, past `finally`.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { AdapterError } from "./adapters.ts";
import type { Flow } from "./adapters.ts";

type N = any;
type Pending = [string, string | null][];
type Ctx = { breaks: Pending | null; loop: { node: string; continues: Pending; forward: boolean } | null };

const slash = (p: string) => p.replace(/\\/g, "/");
const OUTPUT = /^(console\.\w+|process\.std(out|err)\.write|(fs\.)?(promises\.)?(writeFile|appendFile)(Sync)?)$/;
const INPUT = /^(prompt|fetch|(fs\.)?(promises\.)?readFile(Sync)?|(\w+\.)?question)$/;
const EXIT_NAMES: Record<string, Record<string, string>> = {
  if: { true: "Yes", false: "No" }, while: { true: "yes", false: "no" }, for: { true: "next item", false: "done" }, case: { false: "no match" },
};

export async function flowOf(file: string, qualifiedName: string): Promise<Flow> {
  const { API } = await import("typescript/unstable/async");
  const { SyntaxKind: K } = await import("typescript/unstable/ast");
  const source = slash(file);
  const scratch = mkdtempSync(join(tmpdir(), "aidea-tsflow-"));
  const api = new API({ cwd: dirname(file) });
  try {
    writeFileSync(join(scratch, "tsconfig.json"), JSON.stringify({
      compilerOptions: { allowJs: true, noEmit: true, allowImportingTsExtensions: true, module: "esnext", moduleResolution: "bundler", target: "esnext", jsx: "preserve", skipLibCheck: true },
      files: [source],
    }));
    const { program } = (await api.updateSnapshot({ openProjects: [slash(join(scratch, "tsconfig.json"))] })).getProjects()[0];
    if ((await program.getSyntacticDiagnostics()).length) throw new AdapterError("The file cannot be read as TypeScript or JavaScript: fix it, then refresh the Project", 422);
    const sf: N = await program.getSourceFile(source);
    if (!sf) throw new AdapterError("The file cannot be read as TypeScript or JavaScript: fix it, then refresh the Project", 422);

    const lines = readFileSync(file, "utf8").split(/\r?\n/);
    const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
    const first = (n: N) => lineOf(n.getStart(sf));
    const last = (n: N) => lineOf(Math.max(n.getEnd() - 1, 0));
    const ex = (n: N) => n.getText().replace(/\s+/g, " ");
    const nameOf = (n: N): string | undefined => (n.name && "text" in n.name ? n.name.text : undefined);
    const isFn = (n: N) => n?.kind === K.ArrowFunction || n?.kind === K.FunctionExpression;

    // ---- find the function: "name", "Class.method" or "Class.constructor" (the ids typescript-adapter.ts gives, without the module) ----
    const [head, member, ...more] = qualifiedName.split(".");
    let fn: N;
    for (const s of sf.statements as N[]) {
      if (!more.length && !member && s.kind === K.FunctionDeclaration && s.body && (nameOf(s) ?? "default") === head) fn = s;
      else if (!more.length && !member && s.kind === K.VariableStatement) fn ??= s.declarationList.declarations.find((d: N) => d.name.kind === K.Identifier && d.name.text === head && isFn(d.initializer))?.initializer;
      else if (!more.length && member && s.kind === K.ClassDeclaration && (nameOf(s) ?? "default") === head) {
        const m = s.members.find((c: N) => (nameOf(c) ?? (c.kind === K.Constructor ? "constructor" : undefined)) === member && (c.body || isFn(c.initializer)));
        fn = m && (m.kind === K.PropertyDeclaration ? m.initializer : m);
      }
      if (fn) break;
    }
    if (!fn) throw new AdapterError("The function is no longer in its file: refresh the Project", 422);

    // ---- names read and written by some parts of the tree ----
    const isType = (n: N) => n.kind >= K.FirstTypeNode && n.kind <= K.LastTypeNode;
    const assignment = (n: N) => n.kind === K.BinaryExpression && n.operatorToken.kind >= K.FirstAssignment && n.operatorToken.kind <= K.LastAssignment;
    const boundNames = (n: N, into: Set<string>) => {
      if (n.kind === K.Identifier) into.add(n.text);
      else n.forEachChild((c: N) => { if (!isType(c)) boundNames(c.kind === K.BindingElement ? c.name : c, into); });
    };
    const namesIn = (parts: N[], alsoRead: string[] = []) => {
      const reads = new Set<string>(alsoRead), writes = new Set<string>();
      const visit = (n: N, parent: N) => {
        if (isType(n)) return;
        if (n.kind === K.Identifier) {
          const p = parent;
          if (p?.kind === K.PropertyAccessExpression && p.name.pos === n.pos) return;
          if (p && (p.kind === K.PropertyAssignment ? p.name : (p.kind === K.LabeledStatement || p.kind === K.BreakStatement || p.kind === K.ContinueStatement) && p.label)?.pos === n.pos) return;
          if (p && (p.kind === K.VariableDeclaration || p.kind === K.Parameter || p.kind === K.BindingElement) && p.name.pos === n.pos) writes.add(n.text);
          else if (p && assignment(p) && p.left.pos === n.pos) { writes.add(n.text); if (p.operatorToken.kind !== K.EqualsToken) reads.add(n.text); }
          else if (p && (p.kind === K.PostfixUnaryExpression || p.kind === K.PrefixUnaryExpression) && (p.operator === K.PlusPlusToken || p.operator === K.MinusMinusToken)) { writes.add(n.text); reads.add(n.text); }
          else reads.add(n.text);
          return;
        }
        if (assignment(n) && n.left.kind === K.PropertyAccessExpression) writes.add(ex(n.left));
        n.forEachChild((c: N) => visit(c, n));
      };
      parts.forEach((p) => visit(p, undefined));
      return { reads: [...reads].sort(), writes: [...writes].sort() };
    };
    const ioIn = (parts: N[]): "input" | "output" | undefined => {
      let found: "input" | "output" | undefined;
      const visit = (n: N) => {
        if (found || isType(n)) return;
        if (n.kind === K.CallExpression) {
          const callee = n.expression.getText();
          found = OUTPUT.test(callee) ? "output" : INPUT.test(callee) ? "input" : undefined;
        }
        n.forEachChild(visit);
      };
      parts.forEach(visit);
      return found;
    };
    const dedent = (text: string[]) => {
      const indent = Math.min(...text.filter((l) => l.trim()).map((l) => l.length - l.trimStart().length), Infinity);
      return text.map((l) => l.slice(Number.isFinite(indent) ? indent : 0)).join("\n");
    };

    // ---- the graph ----
    const steps: Flow["steps"] = [];
    const edges: Flow["edges"] = [];
    const exits: string[] = []; // return and throw steps go straight to the end
    let inFinally = 0;

    const add = (kind: string, label: string, from: number, to: number, parts: N[] = [], o: { construct?: string; writes?: string[]; alsoRead?: string[]; ioParts?: N[] } & Record<string, unknown> = {}) => {
      const { construct, writes, alsoRead, ioParts, ...extra } = o;
      const names = namesIn(parts, alsoRead);
      const io = ioParts ? ioIn(ioParts) : undefined;
      const text = label.split("\n")[0].trim().replace(/;$/, "");
      const step = {
        id: `n${steps.length}`, kind, construct: construct ?? kind, label: text.length <= 60 ? text : `${text.slice(0, 59)}…`,
        text: dedent(lines.slice(from - 1, to)), line: from, endLine: to, reads: names.reads, writes: writes ?? names.writes,
        ...(io ? { io } : {}), ...extra, ...(inFinally ? { finally: true } : {}),
      };
      steps.push(step);
      return step.id;
    };
    const link = (pending: Pending, target: string, back = false) => {
      for (const [from, label] of pending) edges.push({ from, to: target, ...(label ? { label } : {}), ...(back ? { back: true } : {}) });
    };
    const body = (s: N): N[] => (s.kind === K.Block ? s.statements : [s]);
    // the first line to the line that ends the head of a compound statement (its `{`, or the end of its condition)
    const headLines = (s: N, inner: N, cond: N): [number, number] => [first(s), Math.max(first(s), inner.kind === K.Block ? first(inner) : last(cond))];
    const block = (stmts: N[], pending: Pending, ctx: Ctx): Pending => stmts.reduce((p, s) => statement(s, p, ctx), pending);

    const constructOf = (s: N): [string, boolean] => {
      const found = new Set<number>();
      const walk = (n: N) => { found.add(n.kind); n.forEachChild(walk); };
      walk(s);
      if (found.has(K.ArrowFunction) || found.has(K.FunctionExpression)) return ["lambda", true];
      if (found.has(K.YieldExpression)) return ["yield", true];
      if (found.has(K.AwaitExpression)) return ["await", true];
      if (s.kind === K.VariableStatement) return ["assign", false];
      if (s.kind === K.ExpressionStatement) {
        const e = s.expression;
        if (assignment(e) || e.kind === K.PrefixUnaryExpression || e.kind === K.PostfixUnaryExpression) return ["assign", false];
        return [e.kind === K.CallExpression ? "call" : "expression", false];
      }
      return [K[s.kind].replace(/(Statement|Declaration)$/, "").toLowerCase(), true];
    };

    const statement = (s: N, pending: Pending, ctx: Ctx): Pending => {
      switch (s.kind) {
        case K.EmptyStatement: return pending;
        case K.Block: return block(s.statements, pending, ctx);
        case K.LabeledStatement: return statement(s.statement, pending, ctx);

        case K.IfStatement: {
          const [from, to] = headLines(s, s.thenStatement, s.expression);
          const node = add("branch", `if ${ex(s.expression)}`, from, to, [s.expression], { construct: "if", ioParts: [s.expression] });
          link(pending, node);
          const bodyEnds = block(body(s.thenStatement), [[node, "true"]], ctx);
          const elseEnds = s.elseStatement ? block(body(s.elseStatement), [[node, "false"]], ctx) : [[node, "false"] as [string, string]];
          return [...bodyEnds, ...elseEnds];
        }

        case K.WhileStatement: case K.ForStatement: case K.ForOfStatement: case K.ForInStatement: {
          const [from, to] = headLines(s, s.statement, s.expression ?? s.condition ?? s.incrementor ?? s.initializer ?? s.statement);
          const binding = (i: N) => (i.kind === K.VariableDeclarationList ? i.declarations.map(ex).join(", ") : ex(i));
          const eachOf = s.kind === K.ForOfStatement || s.kind === K.ForInStatement;
          const [label, parts, construct, ioParts] = s.kind === K.WhileStatement ? [`while ${ex(s.expression)}`, [s.expression], "while", [s.expression]]
            : eachOf ? [`for ${s.awaitModifier ? "await " : ""}${binding(s.initializer)} ${s.kind === K.ForOfStatement ? "of" : "in"} ${ex(s.expression)}`, [s.initializer, s.expression], "for", [s.expression]]
              : [`for (${[s.initializer, s.condition, s.incrementor].map((p) => (p ? ex(p) : "")).join("; ")})`, [s.initializer, s.condition, s.incrementor].filter(Boolean), "while", [s.condition].filter(Boolean)];
          const node = add("loop", label as string, from, to, parts as N[], { construct: construct as string, ioParts: ioParts as N[] });
          link(pending, node);
          const inner: Ctx = { breaks: [], loop: { node, continues: [], forward: false } };
          link(block(body(s.statement), [[node, "true"]], inner), node, true);
          return [[node, "false"], ...inner.breaks!];
        }

        case K.DoStatement: {
          const firstBody = steps.length;
          const inner: Ctx = { breaks: [], loop: { node: "", continues: [], forward: true } };
          const ends = block(body(s.statement), pending, inner);
          const node = add("loop", `while ${ex(s.expression)}`, first(s.expression), last(s.expression), [s.expression], { construct: "while", ioParts: [s.expression] });
          link([...ends, ...inner.loop!.continues], node);
          edges.push({ from: node, to: steps[firstBody].id, label: "true", back: true }); // the first step made is the body's entry (the test itself when the body is empty)
          return [[node, "false"], ...inner.breaks!];
        }

        case K.SwitchStatement: {
          const clauses: N[] = s.caseBlock.clauses;
          const cases = clauses.filter((c) => c.kind === K.CaseClause);
          const node = add("branch", `switch ${ex(s.expression)}`, first(s), first(s.caseBlock), [s.expression], { construct: "match", ioParts: [s.expression], exits: cases.map((c) => ex(c.expression)) });
          link(pending, node);
          const inner: Ctx = { breaks: [], loop: ctx.loop };
          let tried: Pending = [[node, null]], carry: Pending = [], fallback: string | undefined;
          for (const c of clauses) {
            let into: Pending;
            if (c.kind === K.CaseClause) {
              const pattern = ex(c.expression);
              const id = add("branch", `case ${pattern}`, first(c), last(c.expression), [c.expression], { construct: "case", pattern });
              link(tried, id);
              tried = [[id, "false"]];
              into = [[id, "true"], ...carry];
            } else {
              fallback = add("step", "default", first(c), first(c), [], { construct: "default" });
              into = [[fallback, null], ...carry];
            }
            carry = block(c.statements, into, inner);
          }
          if (fallback) link(tried, fallback);
          return [...carry, ...inner.breaks!, ...(fallback ? [] : tried)];
        }

        case K.TryStatement: {
          const node = add("step", "try", first(s), first(s.tryBlock), [], { construct: "try" });
          link(pending, node);
          let ends = block(s.tryBlock.statements, [[node, null]], ctx);
          const c = s.catchClause;
          if (c) {
            const caught = "any error";
            const id = add("step", `catch${c.variableDeclaration ? ` (${c.variableDeclaration.name.getText()})` : ""}`, first(c), first(c.block), c.variableDeclaration ? [c.variableDeclaration] : [], { construct: "except", exception: caught });
            link([[node, "error"]], id);
            Object.assign(edges[edges.length - 1], { exception: caught, exit: caught });
            ends = [...ends, ...block(c.block.statements, [[id, null]], ctx)];
          }
          if (!s.finallyBlock) return ends;
          inFinally++;
          try { return block(s.finallyBlock.statements, ends, ctx); } finally { inFinally--; }
        }

        case K.ReturnStatement: case K.ThrowStatement: {
          const kind = s.kind === K.ReturnStatement ? "return" : "raise";
          const node = add(kind, ex(s), first(s), last(s), [s], { ioParts: [s] });
          link(pending, node);
          exits.push(node);
          return [];
        }

        case K.BreakStatement: case K.ContinueStatement: {
          const isBreak = s.kind === K.BreakStatement;
          const target = isBreak ? ctx.breaks : ctx.loop;
          const node = add("step", ex(s), first(s), last(s), [s], { construct: isBreak ? "break" : "continue", ...(s.label || !target ? { generic: true } : {}) });
          link(pending, node);
          if (s.label || !target) return [[node, null]];
          if (isBreak) ctx.breaks!.push([node, null]);
          else if (ctx.loop!.forward) ctx.loop!.continues.push([node, null]);
          else link([[node, null]], ctx.loop!.node, true);
          return [];
        }

        case K.FunctionDeclaration: case K.ClassDeclaration: {
          const isClass = s.kind === K.ClassDeclaration;
          const name = nameOf(s) ?? "default";
          const label = isClass ? `class ${name}` : `${s.modifiers?.some((m: N) => m.kind === K.AsyncKeyword) ? "async " : ""}function${s.asteriskToken ? "*" : ""} ${name}`;
          const node = add("step", label, first(s), first(s), [], { construct: isClass ? "class" : "def", generic: true, writes: [name] });
          link(pending, node);
          return [[node, null]];
        }

        default: {
          const [construct, generic] = constructOf(s);
          const node = add("step", ex(s), first(s), last(s), [s], { construct, ...(generic ? { generic: true } : {}), ...(construct === "assign" || construct === "call" ? { ioParts: [s] } : {}) });
          link(pending, node);
          return [[node, null]];
        }
      }
    };

    // ---- the function itself: start, its body, end ----
    const params: N[] = fn.parameters;
    const written = new Set<string>();
    params.forEach((p) => boundNames(p.name, written));
    const start = add("start", `${member ?? head}(${params.map((p) => ex(p)).join(", ")})`, first(fn), Math.max(first(fn), first(fn.body)), [], { writes: [...written].sort() });
    let pending: Pending = [[start, null]];
    if (fn.body.kind === K.Block) pending = block(fn.body.statements, pending, { breaks: null, loop: null });
    else { // an arrow function whose body is one expression returns it
      const node = add("return", `return ${ex(fn.body)}`, first(fn.body), last(fn.body), [fn.body], { ioParts: [fn.body] });
      link(pending, node);
      exits.push(node);
      pending = [];
    }
    const end = add("end", "end", last(fn), last(fn), [], { writes: [] });
    link([...pending, ...exits.map((id): [string, null] => [id, null])], end);

    // The label of each exit for people, and the list of exits of each step.
    const byId = new Map(steps.map((s) => [s.id, s]));
    for (const e of edges) {
      const from = byId.get(e.from)!;
      const name = from.construct === "case" && e.label === "true" ? (from.pattern as string) : EXIT_NAMES[from.construct as string]?.[e.label ?? ""];
      if (name) e.exit = name;
    }
    for (const s of steps) s.exits ??= edges.filter((e) => e.from === s.id && e.exit).map((e) => e.exit);
    return { steps, edges };
  } finally {
    await api.close();
    rmSync(scratch, { recursive: true, force: true });
  }
}
