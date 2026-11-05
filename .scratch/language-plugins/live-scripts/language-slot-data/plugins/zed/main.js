export function activate(ctx) {
  ctx.languages.provide({
    async analyze(path) {
      const node = (id, kind, name, parent, line) => ({ id, kind, name, parent, file: "app.zz", line, endLine: line + 1 });
      return { nodes: [node("app", "module", "app", null, 1), node("app.Shop", "class", "Shop", "app", 2), node("app.checkout", "function", "checkout", "app", 5)], errors: [], relationships: [{ kind: "calls", from: "app.checkout", to: "app.Shop", name: "Shop", resolution: "resolved", line: 6 }], unresolved: 0 };
    },
  });
}