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

const adapters = new Map<string, LanguageAdapter>([["python", pythonAdapter]]);

export const registerAdapter = (language: string, adapter: LanguageAdapter) => void adapters.set(language, adapter);

export const hasAdapter = (language: string) => adapters.has(language);

// Python is the only adapter, so it serves every Project; the languages a Project holds come from languages.ts.
export const adapterFor = (_projectPath: string): LanguageAdapter => adapters.get("python")!;
