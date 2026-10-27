import type { IncomingMessage, ServerResponse } from "node:http";
import type { ChildProcess } from "node:child_process";

export type CoreNode = { id: string; kind: "module" | "class" | "function"; name: string; parent: string | null };
export type Project = { id: string; name: string; path: string; nodes: CoreNode[]; errors: { file: string; message: string }[] };

// What the core tells the interface about a run of the builder agent.
export type AgentEvent =
  | { type: "session"; sessionId: string }
  | { type: "text"; text: string; parent?: string }
  | { type: "tool"; id: string; name: string; input: unknown; parent?: string }
  | { type: "result"; text: string; costUsd?: number; durationMs?: number; usage: { inputTokens?: number; outputTokens?: number } }
  | { type: "error"; code: "not_installed" | "not_signed_in" | "failed"; message: string };

// An Agent adapter drives one agent product (Claude Code first) and reports aidea events.
export type Adapter = {
  run: (opts: { cwd: string; message: string; sessionId?: string; signal?: AbortSignal }) => AsyncIterable<AgentEvent>;
};

// A spawn-like process source; the real one launches `claude`, tests replay recorded streams.
export type SpawnFn = (args: string[], cwd: string) => Pick<ChildProcess, "stdin" | "stdout" | "stderr" | "on" | "once" | "kill">;

// Shared state and helpers handed to every route module.
export type Core = {
  adapter: Adapter;
  projects: Map<string, Project>;
  send: (res: ServerResponse, status: number, body: unknown, headers?: Record<string, string>) => void;
  // Returns null when the body exceeds the size limit.
  readBody: (req: IncomingMessage) => Promise<string | null>;
};

// A route module's default export: returns true when it handled the request.
export type Handler = (req: IncomingMessage, res: ServerResponse, core: Core) => Promise<boolean>;
