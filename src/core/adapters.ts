// Language adapters: everything that depends on the language of a Project's code lives behind one of these.
// The routes (projects.ts, algorithm.ts, playback.ts) only talk to `adapterFor(...)`; the first adapter is Python (python-adapter.ts).
// ADR 0004 explains why.
//
// An adapter has three operations. `analyze` is required; `flow` and `run` are optional, and the routes answer
// with a plain-words 422 when an adapter leaves one out.
//
//   analyze(projectPath) -> { nodes, errors, relationships, unresolved }
//     Reads every source file of the Project folder: Nodes (modules, classes, functions) and the relationships
//     between them, each with its Resolution. This is the Project minus its id, name and path (see types.ts).
//
//   flow(file, qualifiedName) -> { steps, edges }
//     The control-flow graph of one function: `file` is the absolute path of its file, `qualifiedName` its name
//     inside its module (such as "Scorer.classify"). Steps and edges are the shapes of FlowStep and FlowEdge in
//     layout.ts, plus whatever extra fields the language adds to a step (reads, writes, line, endLine, text).
//
//   run(request) -> { outcome, interpreter }
//     Runs one function once with test data (request.input: args, kwargs, instance, fakes, values, instanceValues,
//     effects). `outcome` is what the run printed, as the Playback route stores it: the steps passed through and the
//     values on arrival, or `unsupported` (text), `invalid` (message per field) or `refused` (calls that need fakes).
//     `interpreter` names what ran the code ("default" or the Project's own).
//
// A failure the person can act on is thrown as an AdapterError with the HTTP status to answer; any other
// error is a crash and is not caught.
import type { Project } from "./types.ts";
import { pythonAdapter } from "./python-adapter.ts";
import { typescriptAdapter } from "./typescript-adapter.ts";
import { detectLanguages, languageOfFile } from "./languages.ts";

export class AdapterError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type Analysis = Pick<Project, "nodes" | "errors" | "relationships" | "unresolved">;
export type Flow = { steps: ({ id: string; kind: string; label: string; io?: string | null; construct?: string } & Record<string, unknown>)[]; edges: { from: string; to: string; label?: string; exit?: string; back?: boolean }[] };
export type RunRequest = {
  projectPath: string;
  moduleId: string;
  qualifiedName: string;
  file: string;
  input: Record<string, unknown>;
  useProjectInterpreter: boolean;
  timeoutMs: number;
};
export type RunResult = { outcome: Record<string, unknown>; interpreter: string };

export type LanguageAdapter = {
  analyze(projectPath: string): Promise<Analysis>;
  flow?(file: string, qualifiedName: string): Promise<Flow>;
  run?(request: RunRequest): Promise<RunResult>;
};

// TypeScript and JavaScript are read by one adapter (typescript-adapter.ts).
const adapters = new Map<string, LanguageAdapter>([["python", pythonAdapter], ["typescript", typescriptAdapter], ["javascript", typescriptAdapter]]);

export const registerAdapter = (language: string, adapter: LanguageAdapter) => void adapters.set(language, adapter);

export const hasAdapter = (language: string) => adapters.has(language);

// The adapter for a Project: the one of the language it holds (languages.ts), or Python when none is analysed.
// ponytail: a Project with several analysed languages merges their analyses (module ids that collide across
// languages, such as util.py and util.js, are not told apart); flow and run go to the adapter of the file's language.
export function adapterFor(projectPath: string): LanguageAdapter {
  const mine = [...new Set(detectLanguages(projectPath).filter((l) => l.analysed).map((l) => adapters.get(l.language)!))];
  if (mine.length === 0) return adapters.get("python")!;
  if (mine.length === 1) return mine[0];
  // The adapter of the file's language does the work; a language without it says so in plain words.
  const of = (file: string, what: string) => {
    const own = languageOfFile(file);
    return { adapter: own && adapters.get(own.language), says: () => new AdapterError(`aidea cannot ${what} ${own?.label ?? "this kind of file"} code yet`, 422) };
  };
  return {
    async analyze(path) {
      const all = await Promise.all(mine.map((a) => a.analyze(path)));
      return {
        nodes: all.flatMap((a) => a.nodes), errors: all.flatMap((a) => a.errors),
        relationships: all.flatMap((a) => a.relationships), unresolved: all.reduce((n, a) => n + a.unresolved, 0),
      };
    },
    ...(mine.some((a) => a.flow) && { flow: async (file: string, name: string) => { const o = of(file, "draw an Algorithm graph for"); if (!o.adapter?.flow) throw o.says(); return o.adapter.flow(file, name); } }),
    ...(mine.some((a) => a.run) && { run: async (req: RunRequest) => { const o = of(req.file, "run functions of"); if (!o.adapter?.run) throw o.says(); return o.adapter.run(req); } }),
  };
}
