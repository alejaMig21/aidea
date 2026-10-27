# 17: Permission mode and model selector in the chat bar

**What to build:** Next to the text input of the chat bar, the person can choose the Permission mode of the builder (for Claude Code: manual, accept edits, plan, auto) and the model it uses. The choices are not written into aidea: the active Agent adapter reports what its provider offers, so connecting another agent later (OpenCode, Codex) shows that agent's own modes and models.

**Not part of v1.** Recorded at the person's request as a later point. v1 runs the builder in Claude Code's default (manual) mode with its default model.

**Blocked by:** 06, 07

**Status:** needs-triage

- [ ] The Agent adapter interface can describe what its provider offers: a list of Permission modes (id, label, one-line meaning, whether it is available and, if not, why) and a list of models (id, label).
- [ ] The Claude Code adapter fills that description from Claude Code itself where Claude Code exposes it (models), and declares what Claude Code documents but does not list (modes) inside the adapter, never in the core or the interface.
- [ ] The chat bar shows one selector for the mode and one for the model, filled only from the active adapter's description.
- [ ] The choice applies to the next message of the conversation and is remembered for each Project.
- [ ] With a different adapter (a fake one in tests) offering other modes and models, the selectors show those and nothing from Claude Code.
- [ ] A mode that is not available (for example auto, which depends on plan, model, provider and client version) is shown with the reason instead of failing silently.
- [ ] `dontAsk` and `bypassPermissions` are not offered unless the person decides otherwise (open decision below).

## Facts checked in the Claude Code documentation

- `--permission-mode` accepts `default` (also `manual`), `acceptEdits`, `plan`, `auto`, `dontAsk`, `bypassPermissions`. `claude -p` takes it as a flag at launch, and aidea launches a new process for every message (continuing the session with `--resume`), so the mode and model can simply be passed as flags each time.
- The Agent SDK can list models: `initializationResult()` returns `models`, `commands`, `agents` and the account; `supportedModels()` returns the models. `setModel()` and `setPermissionMode()` exist only in streaming input mode. No documented call lists the Permission modes: only their type is documented.
- `auto` needs a supported model and provider and a recent client version, and can be switched off by an administrator or server-side.

## Open questions (for a spike before building)

- How to read the model list without adding the Agent SDK package: the control protocol that the SDK uses (an `initialize` request over `--input-format stream-json`) is the candidate, but its exact shape was not found in the documentation. Using the SDK package itself is the documented path; its subscription and policy status is covered by ADR 0001 and the support page that says it works with subscription limits "for now".
- Whether the `--model` flag accepts aliases and how to list them from the command line.
- How to tell, before sending a message, that `auto` is unavailable.
- Whether to offer `dontAsk` and `bypassPermissions` at all.

## Effects on earlier work

- Permission cards (ticket 07) become rarer in accept edits and auto mode, and plan mode adds a request to approve the plan (the `ExitPlanMode` tool), whose card should show the plan as readable text.
- The word "mode" already means Class mode and Direct mode (the Tutor). The glossary calls this one **Permission mode**.
