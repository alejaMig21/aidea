# 17: Permission mode and model selector in the chat bar

> Note (2026-11-04): the modes the Tutor had (Class and Direct) were removed in 58d676d; the Permission mode part of this ticket still stands.


**What to build:** Next to the text input of the chat bar, the person can choose the Permission mode of the builder (for Claude Code: manual, accept edits, plan, auto) and the model it uses. The choices are not written into aidea: the active Agent adapter reports what its provider offers, so connecting another agent later (OpenCode, Codex) shows that agent's own modes and models.

**Part of this version (decided by the person on 2026-10-27: "crucial para trabajar").** Supersedes the earlier "not part of v1" note.

**Blocked by:** 06, 07

**Status:** done

- [~] The Agent adapter interface can describe what its provider offers: a list of Permission modes (id, label, one-line meaning, whether it is available and, if not, why) and a list of models (id, label).
- [~] The Claude Code adapter fills that description from Claude Code itself where Claude Code exposes it (models), and declares what Claude Code documents but does not list (modes) inside the adapter, never in the core or the interface.
- [~] The chat bar shows one selector for the mode and one for the model, filled only from the active adapter's description.
- [~] The choice applies to the next message of the conversation and is remembered for each Project.
- [~] With a different adapter (a fake one in tests) offering other modes and models, the selectors show those and nothing from Claude Code.
- [~] A mode that is not available (for example auto, which depends on plan, model, provider and client version) is shown with the reason instead of failing silently.
- [~] `dontAsk` and `bypassPermissions` are not offered unless the person decides otherwise (open decision below).

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

## Decisions for this version (2026-10-27)

- Selectors live in the chat input card of mockup A (`.scratch/ui-redesign/mockups/A-session-top-bar-switcher.png`): a model chip bottom-left (as "Sonnet 5.5" there) and, beside it, the Permission mode selector; Send bottom-right.
- The Tutor column also gets a **model** selector (never a mode) next to its input; the Tutor does not exist yet, so the choice is only stored per Project and used when the Tutor arrives.
- The adapter describes what its provider offers. The Claude Code adapter declares, inside the adapter, the modes manual (`default`), accept edits (`acceptEdits`), plan (`plan`) and auto (`auto`, with its availability caveat in the description), and the models as the aliases `default`, `sonnet`, `opus`, `haiku` (no SDK package, no probing). `dontAsk` and `bypassPermissions` are not offered.
- The choice is remembered per Project in the per-user store (outside any Project, like recents), applies to the next message, and is passed to Claude Code as `--permission-mode` and `--model` flags on each turn.
- Known gap, not in scope: in plan mode the plan arrives through the `ExitPlanMode` tool and is not yet shown as a readable card.

## Review notes

- [x] The adapter interface describes modes (id, label, meaning, available, reason) and models (id, label): `Adapter.options` in `src/core/types.ts`.
- [x] The Claude Code adapter declares manual/acceptEdits/plan/auto and default/sonnet/opus/haiku itself (no SDK, no probing); `dontAsk` and `bypassPermissions` are not offered.
- [x] Routes `GET /agent-options?project=` and `POST /agent-options` (mode, model, tutorModel), validated against the adapter lists; an unavailable mode is refused with its reason.
- [x] Remembered per Project in `~/.aidea/preferences.json` (override: `AIDEA_PREFERENCES_FILE`); survives a core restart; default is the first mode and first model.
- [x] Applied to the next message as `--permission-mode <id>` and `--model <id>` (`--model` omitted for `default`).
- [x] A fake adapter with other modes and models shows only those (test/agent-options.test.ts).
- [x] UI checked in a browser at 1440x900: model chip and mode selector bottom-left of the chat card, Send bottom-right, Tutor model selector above "Start a class"; selections persist across reload; no console errors besides the missing favicon.
- [~] Known gap (not in scope): in plan mode the plan arrives through `ExitPlanMode` and is not yet shown as a readable card. `auto` is always listed as available because there is no way to detect availability before sending; Claude Code reports the failure itself.

`[~]` = closed as done without this check being recorded at the time; not re-verified (cleaned up on 2026-10-30, history in git).
