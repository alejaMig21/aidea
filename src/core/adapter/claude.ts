import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import type { Adapter, AgentEvent, SpawnFn } from "../types.ts";

// Real process source: the person's installed, unmodified Claude Code. No shell, so the message can never
// be interpreted as a command. Never `--bare`: it ignores the subscription login and the person's plugins.
// Credentials are never read here; Claude Code finds its own login.
// A permission request waits for a person, who may take minutes. Measured with the real Claude Code: without these
// two settings it stops waiting after about 61 seconds; with them a late answer still works. The person's own
// values, if they set any, are kept.
const WAIT_FOR_PERSON_MS = String(30 * 60 * 1000);
const realSpawn: SpawnFn = (args, cwd) =>
  spawn("claude", args, {
    cwd,
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      MCP_TOOL_TIMEOUT: process.env.MCP_TOOL_TIMEOUT ?? WAIT_FOR_PERSON_MS,
      CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT: process.env.CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT ?? WAIT_FOR_PERSON_MS,
    },
  });

// Turns stream-json lines into aidea events. Stateful because Claude Code reports a signed-out run twice
// (an assistant message flagged with `error`, then an error result) and we want a single error event.
export function createParser() {
  let errored = false;
  return (line: string): AgentEvent[] => {
    let j: any;
    try {
      j = JSON.parse(line);
    } catch {
      return [];
    }
    if (j.type === "system" && j.subtype === "init") return [{ type: "session", sessionId: j.session_id }];
    if (j.type === "assistant") {
      // Observed by running with an empty CLAUDE_CONFIG_DIR: `error: "authentication_failed"`, text "Not logged in".
      if (j.error === "authentication_failed") {
        errored = true;
        return [{ type: "error", code: "not_signed_in", message: "Claude Code is not signed in. Run `claude` in a terminal, use /login, then try again." }];
      }
      // Messages from a sub-agent carry the id of the tool call that started them.
      const parent = typeof j.parent_tool_use_id === "string" ? { parent: j.parent_tool_use_id } : {};
      const out: AgentEvent[] = [];
      for (const block of j.message?.content ?? []) {
        if (block.type === "text") out.push({ type: "text", text: block.text, ...parent });
        if (block.type === "tool_use") out.push({ type: "tool", id: block.id, name: block.name, input: block.input, ...parent });
      }
      return out;
    }
    if (j.type === "result") {
      if (j.is_error) {
        if (errored) return [];
        return [{ type: "error", code: "failed", message: String(j.result ?? "Claude Code reported an error") }];
      }
      return [{
        type: "result",
        text: String(j.result ?? ""),
        costUsd: j.total_cost_usd,
        durationMs: j.duration_ms,
        usage: { inputTokens: j.usage?.input_tokens, outputTokens: j.usage?.output_tokens },
      }];
    }
    return [];
  };
}

export function createClaudeAdapter(spawnFn: SpawnFn = realSpawn): Adapter {
  return {
    // Declared here, not read from Claude Code: it documents these but offers no way to list the modes, and the
    // model aliases need no probing. `dontAsk` and `bypassPermissions` are deliberately not offered.
    options: {
      modes: [
        { id: "default", label: "Manual", meaning: "Asks before it edits files or runs commands.", available: true },
        { id: "acceptEdits", label: "Accept edits", meaning: "Edits files without asking; still asks before running commands.", available: true },
        { id: "plan", label: "Plan", meaning: "Reads and plans, and asks you to approve the plan before changing anything.", available: true },
        { id: "auto", label: "Auto", meaning: "Decides by itself what is safe. Needs a supported plan, model, provider and Claude Code version, and an administrator can switch it off.", available: true },
      ],
      models: [
        { id: "default", label: "Default" },
        { id: "sonnet", label: "Sonnet" },
        { id: "opus", label: "Opus" },
        { id: "haiku", label: "Haiku" },
      ],
    },
    async *run({ cwd, message, sessionId, mode, model, signal, permission }) {
      const args = ["-p", "--output-format", "stream-json", "--verbose"];
      if (sessionId) args.push("--resume", sessionId);
      if (mode) args.push("--permission-mode", mode);
      if (model && model !== "default") args.push("--model", model);
      // Permission requests that the person's own rules do not settle go to aidea's tool instead of being denied.
      if (permission) {
        args.push("--mcp-config", permission.mcpConfig, "--permission-prompt-tool", permission.tool);
        // aidea's own tools that only create Proposals write nothing, so they need no card. The person's deny rules still win.
        if (permission.allowedTools.length) args.push("--allowedTools", permission.allowedTools.join(","));
        if (permission.deniedTools.length) args.push("--disallowedTools", permission.deniedTools.join(","));
      }
      const child = spawnFn(args, cwd);

      const lines = createInterface({ input: child.stdout! });
      let spawnError: NodeJS.ErrnoException | undefined;
      child.once("error", (e) => {
        spawnError = e;
        lines.close();
      });
      let stderr = "";
      child.stderr?.on("data", (d) => (stderr = (stderr + d).slice(-2000)));
      const closed = new Promise<number | null>((resolve) => child.once("close", resolve));
      signal?.addEventListener("abort", () => child.kill());

      // The message goes on stdin, not in the arguments, so it can never be mistaken for a flag.
      child.stdin?.on("error", () => {});
      child.stdin?.end(message);

      const parse = createParser();
      let finished = false;
      for await (const line of lines) {
        for (const event of parse(line)) {
          if (event.type === "result" || event.type === "error") finished = true;
          yield event;
        }
      }

      if (spawnError) {
        yield spawnError.code === "ENOENT"
          ? { type: "error", code: "not_installed", message: "Claude Code is not installed (the `claude` command was not found). Install it, sign in, then try again." }
          : { type: "error", code: "failed", message: `Could not start Claude Code: ${spawnError.message}` };
      } else {
        const code = await closed;
        if (!finished) {
          yield { type: "error", code: "failed", message: stderr.trim() || `Claude Code exited with code ${code} without an answer.` };
        }
      }
    },
  };
}
