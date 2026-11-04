# Harness landscape and the Agent Client Protocol (ACP)

Researched 2026-11-03 to answer: should aidea build its own harness, copy a famous one, or talk to existing ones? Sources are web pages read on that date; claims marked "unverified" were not checked in source code.

## What a harness is
Everything except the model: the agent loop, tool definitions, context management, system prompt, permissions and the interface. (Source: [Harness Engineering, arXiv 2609.00006](https://arxiv.org/abs/2609.00006), a source-code study of eleven systems: Claude Code, Codex CLI, Gemini CLI, Mistral Vibe, OpenHands, Aider, Mini-SWE-Agent, Hermes, Pi, OpenCode, OpenClaw.)

Findings of that study that matter here:
- No agent imports a general-purpose agent framework; each hand-rolls an async loop.
- Behaviour policy is moving from prompt text into configuration.
- ACP is shipped in six of the eleven systems.
- The paper includes a 90-line minimum-viable-harness scaffold (not read in full yet).

## Candidates to copy or host
| Harness | Licence | Notes |
|---|---|---|
| OpenCode (`anomalyco/opencode`) | MIT | TypeScript (inferred from Bun and tsconfig files), client/server, built-in agents `build` (full access), `plan` (read-only, asks before bash), `general` (subagent). Per-action permission allow/ask/deny. Many providers (a source says 75+; DeepSeek not verified). A shallow clone was started in the scratchpad, not yet read. |
| Codex CLI | Apache 2.0 | Rust (96%). |
| Pi | unverified | Minimal core: four tools (Read, Write, Edit, Bash). |
| Goose | donated to the Linux Foundation | Rust. |
| Omnigent | unverified | Databricks, June 2026: treats Claude Code, Codex, OpenCode and Hermes as interchangeable behind one API. |
| Gemini CLI | closed successor | Not a candidate. |

## ACP, the adapter seam that already exists as a standard
Source: [agentclientprotocol.com](https://agentclientprotocol.com/overview/introduction).
- Standardises editor-to-agent talk, like LSP did for languages. JSON-RPC over stdio for local agents; HTTP/WebSocket for remote ones (still in progress).
- Agents list: OpenCode, Gemini CLI, Goose, Cline, Cursor, GitHub Copilot, Pi (adapter), OpenHands, Mistral Vibe and about forty more. Claude Code works through Zed's adapter (`claude-agent-acp`); Codex CLI through `codex-acp`.
- Modes: the AGENT declares its modes at session setup (`availableModes`, `currentModeId`). The client lists them and switches with `session/set_mode`; the agent can switch itself and notify with `current_mode_update`. The spec says dedicated mode methods will be removed in favour of Session Config Options.
- Permissions: the agent sends `session/request_permission` with options (`allow_once`, `allow_always`, `reject_once`); the client answers.
- Libraries exist for TypeScript, Python, Rust, Java and Kotlin.

## What this means for aidea
- aidea is the CLIENT. Today it owns a private adapter for `claude -p`. ACP is that same seam, already standardised and already implemented by Claude Code, Codex, OpenCode, Gemini CLI and others.
- Modes then belong to each agent and arrive as data, which is what decision #1446 already wanted (the adapter reports modes). A change of modes in Claude Code, or a new agent, changes no aidea code.
- aidea's own rule (pause at a Blocking decision for a short class) is about aidea's Proposals, not about the agent's modes, so it must hang on aidea's own side (the Proposal flow), independent of any agent mode.
- Building a harness from scratch is feasible (the paper gives a 90-line scaffold) but duplicates OpenCode, which is MIT and already speaks ACP. Not needed to fix the mode problem.

## Open, to verify before a spec
- Does `opencode acp` run and report modes and permission requests as the spec says? (spike)
- Does Claude Code through `claude-agent-acp` keep what aidea's current adapter uses (permission cards, plan card, model list, session resume)?
- Which providers OpenCode offers, DeepSeek included.
- Whether a local model is good enough to act as a "local Claude Code".
