import type { IncomingMessage, ServerResponse } from "node:http";
import type { ChildProcess } from "node:child_process";
import type { Broker } from "./permissions.ts";

export type CoreNode = {
  id: string;
  kind: "module" | "class" | "function";
  name: string;
  parent: string | null;
  file: string; // path relative to the Project folder, with "/" separators
  line: number; // 1-based, inclusive
  endLine: number;
  attributes?: { name: string; line: number }[]; // classes only
};
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
  // `permission` is how the agent can ask aidea for permission: an MCP configuration (JSON text) and the name of its tool.
  run: (opts: { cwd: string; message: string; sessionId?: string; signal?: AbortSignal; permission?: { mcpConfig: string; tool: string } }) => AsyncIterable<AgentEvent>;
};

// A spawn-like process source; the real one launches `claude`, tests replay recorded streams.
export type SpawnFn = (args: string[], cwd: string) => Pick<ChildProcess, "stdin" | "stdout" | "stderr" | "on" | "once" | "kill">;

// Shared state and helpers handed to every route module.
export type Core = {
  adapter: Adapter;
  projects: Map<string, Project>;
  // Playback recordings by id. A recording is replayed from here and never re-run.
  recordings: Map<string, unknown>;
  send: (res: ServerResponse, status: number, body: unknown, headers?: Record<string, string>) => void;
  // The builder's permission requests, waiting for the person's answer.
  permissions: Broker;
  // Returns null when the body exceeds the size limit (64 KB unless a route asks for more).
  readBody: (req: IncomingMessage, maxBytes?: number) => Promise<string | null>;
  // Parses a JSON body; on failure it has already sent the 413 or 400 response and returns undefined.
  readJson: (req: IncomingMessage, res: ServerResponse, maxBytes?: number) => Promise<unknown>;
};

// A route module's default export: returns true when it handled the request.
export type Handler = (req: IncomingMessage, res: ServerResponse, core: Core) => Promise<boolean>;

// Authored layers (ticket 03).
export type AuthoredNode = { id: string; title: string; rationale: { why: string; rejected: { option: string; reason: string }[] }; [field: string]: unknown };
export type AuthoredLayer = { nodes: AuthoredNode[]; errors: { file: string; message: string }[] };
