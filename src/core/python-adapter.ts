// The Python language adapter: the analysis scripts next to this file, run by python.ts. See adapters.ts for the interface.
import { AdapterError } from "./adapters.ts";
import type { Analysis, Flow, LanguageAdapter, RunRequest, RunResult } from "./adapters.ts";
import { projectPython, runPython } from "./python.ts";

// Turns the exit code of a script into a failure the person can act on; anything else is a crash.
function explain(e: unknown, tookTooLong: string): never {
  const failure = e as { code?: number; killed?: boolean };
  if (failure.code === 2) throw new AdapterError("The function is no longer in its file: refresh the Project", 422);
  if (failure.code === 3) throw new AdapterError("The file cannot be read as Python: fix it, then refresh the Project", 422);
  if (failure.killed) throw new AdapterError(tookTooLong, 504);
  throw e;
}

export const pythonAdapter: LanguageAdapter = {
  async analyze(path): Promise<Analysis> {
    return JSON.parse(await runPython("analyze.py", [path]));
  },

  async flow(file, qualifiedName): Promise<Flow> {
    try {
      return JSON.parse(await runPython("flow.py", [file, qualifiedName], { timeoutMs: 30_000 }));
    } catch (e) {
      explain(e, "Building the Algorithm graph took too long");
    }
  },

  // The Project's own virtual environment holds a program that comes with the Project, so it is used only when asked for.
  async run({ projectPath, moduleId, qualifiedName, file, input, useProjectInterpreter, timeoutMs }: RunRequest): Promise<RunResult> {
    const interpreter = useProjectInterpreter ? projectPython(projectPath) : undefined;
    if (useProjectInterpreter && !interpreter) throw new AdapterError("This Project has no virtual environment (.venv, venv or env) to use", 422);
    try {
      const out = await runPython("playback.py", [projectPath, moduleId, qualifiedName, file], {
        input: JSON.stringify(input),
        timeoutMs,
        python: interpreter,
        cwd: projectPath,
      });
      return { outcome: JSON.parse(out), interpreter: interpreter ?? "default" };
    } catch (e) {
      explain(e, "The function ran for too long and was stopped");
    }
  },
};
