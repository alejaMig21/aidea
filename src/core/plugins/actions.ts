// The classes of action (plugin-policies 01): a closed list of what an action can be, so a policy can match it by what it does and where, never by the kind of plugin that does it.
// A plugin declares the classes it uses (manifest `actions`, compared by the scan with what its code does) and the kernel tags every action it mediates with its class and scope.
// The list is also written in docs/plugin-api.md ("Classes of action"); a test keeps them equal.
import { isAbsolute, relative, resolve, sep } from "node:path";

export const ACTION_CLASSES = [
  { id: "writes-project", says: "writes a file inside a Project (its code or its authored layers)" },
  { id: "writes-outside", says: "writes a file outside any Project" },
  { id: "runs-program", says: "starts a program" },
  { id: "uses-network", says: "uses the network" },
  { id: "reads-secrets", says: "reads secrets" },
] as const;
export type ActionClass = (typeof ACTION_CLASSES)[number]["id"];
export const isActionClass = (x: unknown): x is ActionClass => ACTION_CLASSES.some((c) => c.id === x);

// What an action touches: for a write, the path (relative to the Project when it is inside it).
export type ActionScope = { path?: string };
export type Classified = { class?: ActionClass; scope?: ActionScope };

const WRITES = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const NETWORK = new Set(["WebFetch", "WebSearch"]);

// The class and scope of a tool of the Builder (the names Claude Code uses), given the Project it works in. Reading, searching and the tools aidea offers are no class.
export function classOfTool(tool: string, input: Record<string, unknown>, projectPath: string | undefined): Classified {
  if (WRITES.has(tool)) {
    const raw = input.file_path ?? input.notebook_path;
    if (typeof raw !== "string" || !raw || !projectPath) return { class: "writes-project", scope: {} };
    const target = isAbsolute(raw) ? resolve(raw) : resolve(projectPath, raw);
    const rel = relative(resolve(projectPath), target);
    const inside = rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
    return inside ? { class: "writes-project", scope: { path: rel.split(sep).join("/") } } : { class: "writes-outside", scope: { path: raw } };
  }
  if (tool === "Bash") return { class: "runs-program", scope: {} };
  if (NETWORK.has(tool)) return { class: "uses-network", scope: {} };
  return {};
}
