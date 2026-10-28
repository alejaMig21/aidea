import type { IncomingMessage, ServerResponse } from "node:http";
import type { ChildProcess } from "node:child_process";
import type { Broker } from "./permissions.ts";
import type { ProposalStore } from "./proposals.ts";
import type { Recents } from "./recents.ts";
import type { Preferences } from "./preferences.ts";

export type CoreNode = {
  id: string;
  kind: "module" | "class" | "function";
  name: string;
  parent: string | null;
  file: string; // path relative to the Project folder, with "/" separators
  line: number; // 1-based, inclusive
  endLine: number;
  attributes?: { name: string; line: number }[]; // classes only
  // Named parameters in call order, with texts as written in the source.
  parameters?: { name: string; default?: string; annotation?: string; suggestion?: string }[];
  // Methods only: the parameters of the class's constructor, which builds the instance.
  constructorParameters?: { name: string; default?: string; annotation?: string; suggestion?: string }[];
  // External calls in the function's body that need fake data to play, each with a sample literal.
  effects?: { name: string; suggestion: string }[];
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
  // What this agent product offers: its Permission modes and its models. Declared by the adapter, never by the core or the UI.
  options: {
    modes: { id: string; label: string; meaning: string; available: boolean; reason?: string }[];
    models: { id: string; label: string }[];
  };
  // `mode` and `model` are ids from `options`, chosen by the person for this message.
  // `permission` is how the agent can ask aidea for permission: an MCP configuration (JSON text) and the name of its tool.
  run: (opts: { cwd: string; message: string; sessionId?: string; mode?: string; model?: string; signal?: AbortSignal; permission?: { mcpConfig: string; tool: string; allowedTools: string[]; deniedTools: string[] } }) => AsyncIterable<AgentEvent>;
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
  // Changes the builder proposed to the authored layers; nothing is written until the person accepts.
  proposals: ProposalStore;
  // The Projects the person opened before, newest first.
  recents: Recents;
  // The person's mode and model choice for each Project.
  preferences: Preferences;
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
