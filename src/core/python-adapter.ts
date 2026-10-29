// The Python language adapter: the analysis scripts next to this file, run by python.ts. See adapters.ts for the interface.
import { AdapterError } from "./adapters.ts";
import type { Analysis, Example, Flow, LanguageAdapter, RunRequest, RunResult } from "./adapters.ts";
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

  // The arguments the Project's own tests pass to the function: read from their source, never run.
  async examples(projectPath, file, qualifiedName): Promise<Example[]> {
    return JSON.parse(await runPython("examples.py", [projectPath, file, qualifiedName], { timeoutMs: 30_000 }));
  },

  // The Project's own virtual environment is used by default when it has one. The interpreter is only ever found by
  // projectPython at fixed places inside the Project folder; a request can switch it on or off, never name a path.
  async run({ projectPath, moduleId, qualifiedName, file, input, useProjectInterpreter, timeoutMs }: RunRequest): Promise<RunResult> {
    const interpreter = useProjectInterpreter === false ? undefined : projectPython(projectPath);
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
      const failure = e as { code?: number | string; killed?: boolean; stderr?: string };
      // A venv whose Python cannot start or crashes (moved folder, deleted base Python) is not the function's fault.
      if (interpreter && !failure.killed && failure.code !== 2 && failure.code !== 3) {
        const why = String(failure.stderr ?? "").trim().split(/\r?\n/).pop() || String(failure.code ?? "unknown error");
        throw new AdapterError(`The Project's interpreter ${interpreter} did not run: ${why}. Fix the environment, or play with aidea's own Python by unticking the option.`, 422);
      }
      explain(e, "The function ran for too long and was stopped");
    }
  },
};
