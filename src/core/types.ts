import type { IncomingMessage, ServerResponse } from "node:http";

export type CoreNode = { id: string; kind: "module" | "class" | "function"; name: string; parent: string | null };
export type Project = { id: string; name: string; path: string; nodes: CoreNode[]; errors: { file: string; message: string }[] };

// Shared state and helpers handed to every route module.
export type Core = {
  projects: Map<string, Project>;
  send: (res: ServerResponse, status: number, body: unknown, headers?: Record<string, string>) => void;
  // Returns null when the body exceeds the size limit.
  readBody: (req: IncomingMessage) => Promise<string | null>;
};

// A route module's default export: returns true when it handled the request.
export type Handler = (req: IncomingMessage, res: ServerResponse, core: Core) => Promise<boolean>;

// Authored layers (ticket 03).
export type AuthoredNode = { id: string; title: string; rationale: { why: string; rejected: { option: string; reason: string }[] }; [field: string]: unknown };
export type AuthoredLayer = { nodes: AuthoredNode[]; errors: { file: string; message: string }[] };
