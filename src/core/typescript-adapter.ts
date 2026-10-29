// The TypeScript and JavaScript language adapter (ADR 0004): reads .ts .tsx .mts .cts .js .jsx .mjs .cjs files with the
// TypeScript compiler's API, which is already a dependency. `analyze` and `flow` (typescript-flow.ts) are offered; run comes with a later ticket.
//
// The compiler needs a project file to open, so a throw-away tsconfig listing the Project's files is written to the
// temp folder (the Project itself is never touched). Nothing of the Project is run.
//
// Nodes and relationships have the shapes analyze.py gives (see types.ts). Module ids are the file path without its
// extension ("src/core/main"), so `src/core/main.Scorer.classify` is a method. Resolution:
//   resolved    the compiler found the target in the Project (imports, base classes, calls), or a base class that is
//               certainly outside it (`external`);
//   inferred    the compiler knew only an interface or nothing about the receiver, so it is matched by method name;
//   unresolved  calls through parameters, variables, computed keys or call results; imports with a computed name.
// Calls to code outside the Project are not relationships and are left out, as in the Python adapter.
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import type { Analysis, LanguageAdapter } from "./adapters.ts";
import type { CoreNode, Relationship } from "./types.ts";
import { flowOf } from "./typescript-flow.ts";

// Folders that hold copies of code or libraries, not the Project's own (the same set as analyze.py); hidden folders are skipped too.
export const SKIP_DIRS = new Set(["__pycache__", "venv", "env", "node_modules", "dist", "build", "site-packages"]);

const SOURCE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
const slash = (p: string) => p.replace(/\\/g, "/");

function sourceFiles(root: string): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith(".")) walk(join(dir, e.name)); }
      else if (SOURCE.test(e.name) && !/\.d\.[cm]?ts$/.test(e.name)) found.push(slash(join(dir, e.name)));
    }
  };
  walk(root);
  return found;
}

// The compiler's tree is read through its public shape; its types are still marked unstable, so nodes are `any` here.
type N = any;

async function analyze(root: string): Promise<Analysis> {
  const files = sourceFiles(root);
  const empty = { nodes: [], errors: [], relationships: [], unresolved: 0 };
  if (!files.length) return empty;
  const { API } = await import("typescript/unstable/async");
  const { SyntaxKind: K } = await import("typescript/unstable/ast");

  const scratch = mkdtempSync(join(tmpdir(), "aidea-ts-"));
  const api = new API({ cwd: root });
  try {
    writeFileSync(join(scratch, "tsconfig.json"), JSON.stringify({
      compilerOptions: { allowJs: true, noEmit: true, allowImportingTsExtensions: true, module: "esnext", moduleResolution: "bundler", target: "esnext", jsx: "preserve", skipLibCheck: true },
      files,
    }));
    const project = (await api.updateSnapshot({ openProjects: [slash(join(scratch, "tsconfig.json"))] })).getProjects()[0];
    const { program, checker } = project;

    // A file the parser rejects is a problem for that file; the others are still read.
    const relOf = new Map(files.map((f) => [f.toLowerCase(), slash(relative(root, f))]));
    const errors: { file: string; message: string }[] = [];
    const broken = new Set<string>();
    for (const d of await program.getSyntacticDiagnostics()) {
      const file = relOf.get(slash(d.fileName ?? "").toLowerCase());
      if (!file || broken.has(file)) continue;
      broken.add(file);
      const sf = await program.getSourceFile(d.fileName!);
      errors.push({ file, message: `${d.text} (line ${sf ? sf.getLineAndCharacterOfPosition(d.pos).line + 1 : 1})` });
    }

    const nodes: CoreNode[] = [];
    const byId = new Map<string, CoreNode>();
    const nodeOfDecl = new Map<string, string>(); // "<file path>#<tree index>" of a declaration -> Node id
    const moduleOfPath = new Map<string, string>(); // compiler path of a file -> module id
    const own = new Set<string>();
    const sources: { id: string; sf: N; roots: N[]; skipDeclared: boolean }[] = [];
    const classes: { id: string; sf: N; ast: N }[] = [];
    const imports: { module: string; sf: N; ast: N }[] = [];
    const methodsByName = new Map<string, string[]>();
    const keyOf = (sf: N, n: N) => `${sf.path}#${n.index}`;
    const hasModifier = (n: N, kind: number) => (n.modifiers ?? []).some((m: N) => m.kind === kind);
    const lineOf = (sf: N, pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
    const nameOf = (n: N): string | undefined => (n.name && "text" in n.name ? n.name.text : undefined);
    const isFunction = (n: N) => n?.kind === K.ArrowFunction || n?.kind === K.FunctionExpression;
    // a declaration that is its own Node: its body is walked for its own calls, not its enclosing Node's
    const isDeclared = (n: N) => n.kind === K.ClassDeclaration || n.kind === K.FunctionDeclaration || (n.kind === K.VariableDeclaration && isFunction(n.initializer));

    const parameters = (fn: N) => fn.parameters.filter((p: N) => p.name.text !== "this").map((p: N) => ({
      name: p.name.getText(),
      ...(p.initializer ? { default: p.initializer.getText() } : {}),
      ...(p.type ? { annotation: p.type.getText() } : {}),
    }));

    const add = (sf: N, file: string, id: string, kind: CoreNode["kind"], name: string, parent: string | null, ast: N, extra: Partial<CoreNode>, declAst: N = ast): CoreNode | undefined => {
      if (byId.has(id)) return undefined; // overloads and getter/setter pairs share a name: the first one is the Node
      const node: CoreNode = { id, kind, name, parent, file, line: lineOf(sf, ast.getStart(sf)), endLine: lineOf(sf, Math.max(ast.getEnd() - 1, 0)), ...extra };
      nodes.push(node);
      byId.set(id, node);
      nodeOfDecl.set(keyOf(sf, declAst), id);
      return node;
    };

    for (const file of files) {
      const rel = slash(relative(root, file));
      if (broken.has(rel)) continue;
      const sf = await program.getSourceFile(file);
      if (!sf) continue;
      const plain = rel.replace(SOURCE, "");
      const module = byId.has(plain) ? rel : plain;
      add(sf, rel, module, "module", module, null, sf, { line: 1, endLine: Math.max(sf.getLineStarts().length, 1) });
      moduleOfPath.set(sf.path, module);
      own.add(sf.path);
      sources.push({ id: module, sf, roots: [...sf.statements], skipDeclared: true });

      const addFunction = (parent: string, name: string, ast: N, fn: N, markers: CoreNode["markers"], extra: Partial<CoreNode> = {}) => {
        const node = add(sf, rel, `${parent}.${name}`, "function", name, parent, ast, { parameters: parameters(fn), markers, ...extra });
        if (node && fn.body) sources.push({ id: node.id, sf, roots: [fn.body], skipDeclared: false });
        return node;
      };
      const addClass = (stmt: N) => {
        const name = nameOf(stmt) ?? "default";
        const attributes: { name: string; line: number }[] = [];
        const node = add(sf, rel, `${module}.${name}`, "class", name, module, stmt, { attributes, markers: { visibility: "public", ...(hasModifier(stmt, K.AbstractKeyword) ? { abstract: true as const } : {}) } });
        if (!node) return;
        classes.push({ id: node.id, sf, ast: stmt });
        const ctor = stmt.members.find((m: N) => m.kind === K.Constructor);
        for (const m of stmt.members) {
          const member = nameOf(m) ?? (m.kind === K.Constructor ? "constructor" : undefined);
          if (!member) continue;
          const visibility = hasModifier(m, K.PrivateKeyword) || member.startsWith("#") ? "private" : m.kind === K.Constructor ? "special" : "public";
          const markers = { visibility, ...(hasModifier(m, K.StaticKeyword) ? { static: true as const } : {}), ...(hasModifier(m, K.AbstractKeyword) ? { abstract: true as const } : {}), ...(m.kind === K.GetAccessor || m.kind === K.SetAccessor ? { property: true as const } : {}) } as CoreNode["markers"];
          const constructorParameters = ctor ? parameters(ctor) : [];
          if (m.kind === K.MethodDeclaration || m.kind === K.GetAccessor || m.kind === K.SetAccessor || m.kind === K.Constructor) {
            if (!m.body && !hasModifier(m, K.AbstractKeyword)) continue;
            const made = addFunction(node.id, member, m, m, markers, { constructorParameters });
            if (made && m.kind !== K.Constructor) methodsByName.set(member, [...(methodsByName.get(member) ?? []), made.id]);
          } else if (m.kind === K.PropertyDeclaration) {
            if (isFunction(m.initializer)) addFunction(node.id, member, m, m.initializer, markers, { constructorParameters });
            else { attributes.push({ name: member, line: lineOf(sf, m.getStart(sf)) }); (node.attributeVisibility ??= {})[member] = visibility === "private" ? "private" : "public"; }
          }
        }
        node.attributeVisibility ??= {};
      };
      for (const stmt of sf.statements as unknown as N[]) {
        if (stmt.kind === K.ClassDeclaration) addClass(stmt);
        else if (stmt.kind === K.FunctionDeclaration && stmt.body) addFunction(module, nameOf(stmt) ?? "default", stmt, stmt, { visibility: "public" });
        else if (stmt.kind === K.VariableStatement) {
          for (const d of stmt.declarationList.declarations) {
            if (d.name.kind === K.Identifier && isFunction(d.initializer)) addFunction(module, d.name.text, d, d.initializer, { visibility: "public" });
          }
        } else if (stmt.kind === K.ImportDeclaration || (stmt.kind === K.ExportDeclaration && stmt.moduleSpecifier)) imports.push({ module, sf, ast: stmt });
      }
    }

    // ---- relationships ----
    const rels: Relationship[] = [];
    const seen = new Set<string>();
    const addRel = (kind: Relationship["kind"], from: string, to: string | null, name: string, resolution: Relationship["resolution"], line: number, extra: Partial<Relationship> = {}) => {
      const key = [kind, from, to, name, resolution, resolution === "unresolved" ? line : 0, (extra.names ?? []).join()].join("|");
      if (seen.has(key)) return;
      seen.add(key);
      rels.push({ kind, from, to, name, resolution, line, ...extra });
    };

    // What a symbol finally stands for: an import is followed to the export, and `module.exports = { name }` to `name`.
    const followed = new Map<number, N>();
    const follow = async (s: N): Promise<N> => {
      if (s.flags & 2097152 /* SymbolFlags.Alias */) s = await checker.getAliasedSymbol(s);
      const decl = s.declarations[0];
      if (decl?.kind === K.ShorthandPropertyAssignment) s = (await checker.getShorthandAssignmentValueSymbol(await decl.resolve())) ?? s;
      return s;
    };
    const symbolsAt = async (sites: N[]) => {
      const found: N[] = sites.length ? await checker.getSymbolAtLocation(sites) : [];
      for (let i = 0; i < found.length; i++) {
        const s = found[i];
        if (!s) continue;
        if (!followed.has(s.id)) followed.set(s.id, await follow(s));
        found[i] = followed.get(s.id);
      }
      return found;
    };
    // The module a string literal names: the Project module id, null when it is outside the Project, "?" when nothing was found.
    const moduleNamed = async (literal: N): Promise<string | null | "?"> => {
      const sym = (await symbolsAt([literal]))[0];
      const decl = sym?.declarations.find((d: N) => d.kind === K.SourceFile);
      if (!decl) return String(literal.text).startsWith(".") ? "?" : null;
      return moduleOfPath.get(decl.path) ?? null;
    };
    const targetOf = (id: string) => (byId.get(id)!.kind === "class" ? (classMember(id, "constructor") ?? id) : id);
    const classMember = (cls: string, name: string) => byId.get(`${cls}.${name}`)?.kind === "function" ? `${cls}.${name}` : undefined;

    for (const { module, sf, ast } of imports) {
      const spec = ast.moduleSpecifier;
      if (spec?.kind !== K.StringLiteral) continue;
      const target = await moduleNamed(spec);
      const clause = ast.importClause;
      const names: string[] = [];
      if (clause?.name) names.push("default");
      if (clause?.namedBindings?.kind === K.NamespaceImport) names.push("*");
      for (const el of clause?.namedBindings?.elements ?? []) names.push((el.propertyName ?? el.name).text);
      const line = lineOf(sf, ast.getStart(sf));
      if (target === "?") addRel("imports", module, null, spec.text, "unresolved", line);
      else if (target) addRel("imports", module, target, spec.text, "resolved", line, names.length ? { names } : {});
    }

    for (const { id, sf, ast } of classes) {
      const base = ast.heritageClauses?.find((h: N) => h.token === K.ExtendsKeyword)?.types[0];
      if (!base) continue;
      const expr = base.expression;
      const line = lineOf(sf, base.getStart(sf));
      const written = expr.getText();
      const site = expr.kind === K.PropertyAccessExpression ? expr.name : expr.kind === K.Identifier ? expr : undefined;
      const sym = site ? (await symbolsAt([site]))[0] : undefined;
      const decls: N[] = sym?.declarations ?? [];
      const target = decls.map((d) => nodeOfDecl.get(`${d.path}#${d.index}`)).find((t) => t && byId.get(t)!.kind === "class");
      if (target) addRel("inherits", id, target, written, "resolved", line);
      else if (decls.length && !decls.some((d) => own.has(d.path))) addRel("inherits", id, null, written, "resolved", line, { external: true });
      else addRel("inherits", id, null, written, "unresolved", line);
    }

    // Calls: one batch of questions to the compiler per file.
    for (const sf of new Set(sources.map((s) => s.sf))) {
      const calls: { from: string; call: N; site?: N }[] = [];
      for (const s of sources.filter((x) => x.sf === sf)) {
        const visit = (n: N) => {
          if (s.skipDeclared && isDeclared(n)) return;
          if (s.skipDeclared && n.kind === K.ImportDeclaration) return;
          if (n.kind === K.CallExpression || n.kind === K.NewExpression) {
            let e = n.expression;
            while (e.kind === K.ParenthesizedExpression || e.kind === K.NonNullExpression) e = e.expression;
            calls.push({ from: s.id, call: n, site: e.kind === K.PropertyAccessExpression ? e.name : e.kind === K.Identifier ? e : undefined });
          }
          n.forEachChild(visit);
        };
        s.roots.forEach(visit);
      }
      const symbols = await symbolsAt(calls.map((c) => c.site).filter(Boolean));
      let next = 0;
      for (const { from, call, site } of calls) {
        const sym = site ? symbols[next++] : undefined;
        const line = lineOf(sf, call.getStart(sf));
        let e = call.expression;
        while (e.kind === K.ParenthesizedExpression || e.kind === K.NonNullExpression) e = e.expression;
        const name = site ? site.text : "";
        if (e.kind === K.SuperKeyword) continue;
        // dynamic imports: import("x") and require("x")
        if (e.kind === K.ImportKeyword || (e.kind === K.Identifier && e.text === "require" && !sym?.declarations.some((d: N) => own.has(d.path)))) {
          const arg = call.arguments[0];
          const label = e.kind === K.ImportKeyword ? "import" : "require";
          if (arg?.kind !== K.StringLiteral && arg?.kind !== K.NoSubstitutionTemplateLiteral) { addRel("imports", from, null, label, "unresolved", line); continue; }
          const target = await moduleNamed(arg);
          if (target === "?") addRel("imports", from, null, arg.text, "unresolved", line);
          else if (target) addRel("imports", from, target, arg.text, "resolved", line);
          continue;
        }
        if (!site) {
          if (e.kind === K.ElementAccessExpression) addRel("calls", from, null, `${e.expression.getText()}[]`, "unresolved", line);
          else if (e.kind === K.CallExpression) addRel("calls", from, null, e.expression.getText(), "unresolved", line);
          continue;
        }
        const decls: N[] = sym?.declarations ?? [];
        const mapped = decls.map((d) => nodeOfDecl.get(`${d.path}#${d.index}`)).filter((t): t is string => !!t);
        if (mapped.length) { for (const t of mapped) addRel("calls", from, targetOf(t), name, "resolved", line); continue; }
        const inProject = decls.length > 0 && decls.every((d) => own.has(d.path));
        // a variable holding a function written in place is a nested function: left to its enclosing Node, like Python's
        const localFunction = inProject && decls.length === 1 && decls[0].kind === K.VariableDeclaration && isFunction((await decls[0].resolve())?.initializer);
        if (inProject && !localFunction && decls.some((d) => d.kind === K.Parameter || d.kind === K.VariableDeclaration || d.kind === K.BindingElement)) addRel("calls", from, null, name, "unresolved", line);
        else if (e.kind === K.PropertyAccessExpression && (!decls.length || inProject)) for (const t of methodsByName.get(name) ?? []) addRel("calls", from, t, name, "inferred", line);
      }
    }

    rels.sort((a, b) => a.from.localeCompare(b.from) || a.kind.localeCompare(b.kind) || a.line - b.line || a.name.localeCompare(b.name) || (a.to ?? "").localeCompare(b.to ?? ""));
    return { nodes, errors, relationships: rels, unresolved: rels.filter((r) => r.resolution === "unresolved").length };
  } finally {
    await api.close();
    rmSync(scratch, { recursive: true, force: true });
  }
}

export const typescriptAdapter: LanguageAdapter = { analyze, flow: flowOf };
