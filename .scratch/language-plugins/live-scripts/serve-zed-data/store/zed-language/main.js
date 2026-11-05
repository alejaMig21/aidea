// A language plugin that only analyzes (the first step of the skill: analyze, and stop there if that is all that is needed).
// It draws one module for each file of the language. Change EXTENSION here and `extensions` in the manifest together, then make `analyze` find what the language really has:
// classes, functions and the relationships between them (docs/plugin-api.md, "The language slot"). It reads files only and starts no program, so it declares no "processes".
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";

const EXTENSION = ".zed";

export function activate(ctx) {
  ctx.languages.provide({
    async analyze(projectPath) {
      const nodes = [];
      const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
          const path = join(dir, entry.name);
          if (entry.isDirectory()) walk(path);
          else if (entry.name.toLowerCase().endsWith(EXTENSION)) {
            const file = relative(projectPath, path).split("\\").join("/");
            nodes.push({ id: file, kind: "module", name: entry.name, parent: null, file, line: 1, endLine: 1 });
          }
        }
      };
      walk(projectPath);
      return { nodes, errors: [], relationships: [], unresolved: 0 };
    },
  });
}
