# Drive the unmodified `claude` binary instead of writing an agent loop

aidea does not implement its own agent loop. It launches the user's installed, unmodified Claude Code as a child process through an agent adapter, and never reads, stores or relays the user's Claude credentials. Anthropic's Legal and Compliance page forbids third-party apps from routing requests through Free/Pro/Max credentials or intermediating tokens, but allows an end user to sign in to the unmodified binary with their own subscription. The user keeps their existing plugins, skills, hooks, `CLAUDE.md` and MCP servers, and aidea spends its effort on the canvas, derivation and tutor. Using the Agent SDK with a subscription was judged a grey area and is avoided.

## Consequences

- Fine control of the loop (internal prompts, retries, context handling) is lost; influence comes from `--append-system-prompt`, hooks and aidea's own MCP server.
- Other agents can be added later as further adapters.
- The first adapter uses `claude -p` with `--output-format stream-json`, which Anthropic's support page says still draws on subscription limits "for now". A second adapter that embeds an interactive terminal is the planned fallback if that changes.
- The tutor is a separate session from the builder agent, and the adapter is chosen per role. Both use Claude Code at first; later the tutor may come from another provider.
