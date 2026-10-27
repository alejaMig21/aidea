// Permission requests from the builder wait here until the person answers them.
// One conversation with the builder is a "run"; it has a secret token that only the Claude Code process we started knows.
import { randomBytes } from "node:crypto";

export type Decision = { behavior: "allow" } | { behavior: "deny"; message: string };

type Run = { emit: (event: object) => void; pending: Map<string, (decision: Decision) => void> };

export function createBroker() {
  const runs = new Map<string, Run>();
  const runOf = new Map<string, Run>(); // request id -> the run that asked
  let counter = 0;

  return {
    // A conversation starts. `emit` sends an event to the person's chat stream.
    open(emit: (event: object) => void) {
      const token = randomBytes(16).toString("hex");
      const run: Run = { emit, pending: new Map() };
      runs.set(token, run);
      return {
        token,
        // The conversation is over: whatever is still waiting is denied, so the builder does not hang.
        close() {
          runs.delete(token);
          for (const [id, resolve] of run.pending) {
            runOf.delete(id);
            resolve({ behavior: "deny", message: "The conversation ended before the person answered" });
          }
          run.pending.clear();
        },
      };
    },

    isOpen: (token: string) => runs.has(token),

    // The builder asks for permission. Resolves when the person answers; undefined if the conversation is not running.
    ask(token: string, tool: string, input: unknown): Promise<Decision> | undefined {
      const run = runs.get(token);
      if (!run) return undefined;
      const id = `perm-${++counter}`;
      return new Promise((resolve) => {
        run.pending.set(id, resolve);
        runOf.set(id, run);
        run.emit({ type: "permission", id, tool, input });
      });
    },

    // The person answers. False when the request is unknown or was already answered.
    answer(id: string, decision: Decision): boolean {
      const run = runOf.get(id);
      const resolve = run?.pending.get(id);
      if (!run || !resolve) return false;
      run.pending.delete(id);
      runOf.delete(id);
      resolve(decision);
      return true;
    },
  };
}

export type Broker = ReturnType<typeof createBroker>;
