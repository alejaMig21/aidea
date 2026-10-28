# Research 03: Spike: can Claude Code host the Tutor roles?

Ticket 01. Measured on 2026-10-28 with the installed Claude Code 2.1.312 on Windows 11, subscription login (`apiKeySource: none` in the init event), using 18 real model calls. A fake tool server (Node, HTTP JSON-RPC in the style of `src/core/routes/mcp.ts`) and all logs lived in `%TEMP%\tutor-spike` and were deleted at the end. No product code, no credentials read, no change to global settings. Every `claude` call ran with that directory as cwd.

Cost numbers are `total_cost_usd` as Claude Code reports it. `modelUsage.*.costBasis` says `"list"`, so it is a list-price estimate, not what the subscription charges. What the subscription spends is plan limit, which this spike cannot see in dollars.

## TL;DR

- Isolation WORKS with one flag combination (section a). Init event proved: only my tools, no skills, no slash commands, no user plugins, no hooks, no CLAUDE.md; the model quoted my system prompt back.
- Blocking question tool: GO WITH CAVEATS. A 130 s wait survived with the adapter's two env settings. Without them, the call dies at exactly 60 s with an error the model reads, and the model then RE-ASKS. 30-minute waits were NOT tested.
- Tool arguments rejected with an error text: GO. The model read the error and fixed the call in the same turn. Caveat: it may ask the person first, and it rounds data on its own.
- End the turn right after a question: GO WITH CAVEATS (1 trial, haiku, worked first time). Fallback is the blocking tool.
- Resume: NO-GO as "just pass the id". `--resume` with no flags brought back ALL the person's plugins, skills, tools, hooks and MCP servers (37k-token context). Every isolation flag must be passed again, and the new `--system-prompt` is ignored (snapshot of the first one is kept).
- Concurrency: GO. Two sessions with different instructions at once, and four at once, no login or rate-limit error.
- Models: `haiku`, `sonnet`, `opus` and a full id (`claude-haiku-5-5`) all work. Unknown names fail cleanly at zero cost. On the same Auditor task: haiku $0.0005, sonnet $0.0086, opus $0.0186 (17x and 37x).
- Per role: Prober GO, Teacher GO WITH CAVEATS (long waits, resume), Extractor GO (use `--json-schema`), Auditor GO.
- Biggest risks: (1) a 30-minute wait is untested; (2) resume loses isolation unless every flag is repeated; (3) `usage.input_tokens` excludes cache tokens, so the adapter's token counts understate; (4) the user's email still reaches the isolated model's context.
- Calls used: 18 of 20.

## (a) Isolation

**Tried.** One combination, run on haiku (call 1), and the same set reused in every later call:

```
claude -p --output-format stream-json --verbose --model haiku \
  --system-prompt "<role prompt>" \
  --setting-sources "" \
  --strict-mcp-config --mcp-config mcp.json \
  --disable-slash-commands \
  --tools "" \
  [--allowedTools "mcp__tt__*"] [--no-session-persistence]      # prompt on stdin
```

`mcp.json`: `{"mcpServers":{"tt":{"type":"http","url":"http://127.0.0.1:8799/mcp"}}}`.

**Observed (init event, call 1):**
- `tools`: only `mcp__tt__ask`, `mcp__tt__done`, `mcp__tt__submit` (so `--tools ""` removes every built-in, including Bash, Read, Write, Skill, ToolSearch and the Task/Agent tool).
- `mcp_servers`: only `tt`, `source: dynamic`.
- `slash_commands: []`, `skills: []`.
- `plugins`: only three built-in ones (`cc-plugin-agents-md`, `cc-plugin-telemetry`, `cc-plugin-plugin-authoring`, `path: builtin`). None of the person's plugins (engram, ponytail, caveman, pyright-lsp).
- No `hook_started` events at all (they appear in the unisolated resume, call 8).
- The model, asked to quote its instructions, quoted "You are a Claude agent, built on Anthropic's Claude Agent SDK." followed by my text, answered with my secret codeword, listed only the three tools, said it knew of no skills and no CLAUDE.md or memory content.
- `agents` still lists built-in sub-agent names, but with no Task/Agent tool they cannot be used.

**Caveats / what this does not show.**
- `--system-prompt` replaces Claude Code's default prompt, but a one-line built-in prefix ("You are a Claude agent, built on Anthropic's Claude Agent SDK.") stays in front of mine. Not a problem, but "replace" is not 100% literal. `--append-system-prompt` was not tested.
- The model said its context held "a user email identifier and environment details". The person's email (the account identity) still reaches the model. It is not a credential, but it is not fully isolated either. No flag found to remove it.
- The init event reports `memory_paths.auto` (an auto-memory folder under `~/.claude/projects/<cwd-slug>/memory`). The model had no memory content, and with no Write tool it cannot write there. Not further tested.
- I tested the combination only, not each flag alone, so I do not know which flags are individually necessary. `--setting-sources ""` (empty list) is accepted and is what removed the user plugins/hooks/CLAUDE.md in practice.
- The help also lists `--safe-mode` (all customizations off, auth works) and `--restricted`; not tested. `--safe-mode` might disable `--mcp-config` servers too (the help says MCP servers are disabled), so the combination above is the one with evidence.
- `--bare` was not used (ignores the subscription login, per the adapter and the help text). `--max-turns` does not exist in this version's `claude -p --help`. There is `--max-budget-usd` (untested) and `--effort` (untested).
- System prompts were passed as command-line arguments, all under 500 characters. A long role prompt may hit the Windows command-line length limit; the help text mentions `--system-prompt-file` / `--append-system-prompt-file` (inside the `--bare` description) but I did not test them.
- The parent shell had `CLAUDE_CODE_*` variables from the session I run in (session id, messaging socket). Calls worked anyway; the real core starts outside Claude Code so this may differ. Not tested.

**Confidence:** high that this combination isolates; medium on which flags are individually needed.

## (b) Own tool server and long waits

**Tried.** Fake server: `ask` (blocks N seconds, read from a file at each call, then answers), `submit` (rejects bad confidence), `done`. Teacher-like prompt: call `ask` once with a predict question, wait, state one fact, call `done`. Same command as (a) plus `--allowedTools "mcp__tt__*"` (the wildcard form works; without `--allowedTools` I did not test whether the call is denied).

| Call | Wait | Env settings | Result |
|---|---|---|---|
| 2 | 20 s | none | worked |
| 3 | 70 s | none | server log: connection closed by the client at 60.0 s (`09:50:07.157` call, `09:51:07.158` closed). Tool result to the model: `is_error`, text "The operation timed out." The model told the learner and asked AGAIN (second `ask`, same question), which timed out again at 60 s. Run lasted 131 s, ended with a text apologising. The server handler kept running and "answered" 70 s later into a closed connection. |
| 4 | 70 s | `MCP_TOOL_TIMEOUT=1800000` and `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT=1800000` | worked, answer delivered, model continued |
| 18 | 130 s | same two | worked (138 s total) |

- While a tool call is pending, the stream carries `tool_progress` events with `heartbeat: true`, `tool_name`, `elapsed_time_seconds` (observed 30 s steps). Useful for a "still waiting" signal and for knowing the process is alive.
- Both env vars were always set together, so I do not know if one alone is enough.
- When Claude Code gives up it closes the HTTP connection; `mcp.ts` already withdraws the card on `res.on("close")`. The retry then creates a second card, so a timeout means a duplicate question, not just a failure.
- The model's second turn after the error was not a crash: the run ended `success`. The failure is visible only in the tool result and the model's text.

**Not tested:** anything beyond 138 s. The adapter's note says 30 minutes works for permission prompts; for a Teacher `ask` I have evidence up to 130 s only. Stdio MCP servers were not tried; HTTP only.

**Confidence:** high up to 130 s and for the 60 s failure without env; unknown for 30 min.

## (c) Sequential and concurrent sessions

**Tried.** Sequential: calls 1 to 9 each used a different system prompt (Teacher, Extractor-like, codeword prompts), no interference. Concurrent: call 10 and 11 launched together, roles `Teacher` (codeword ALPHA-1) and `Prober` (BETA-2), each calling `ask` with a 20 s wait against the same server. Later 4 calls (sonnet, opus, haiku full id, an invalid model) were started at once.

**Observed.** Both returned `ROLE=Teacher CODEWORD=ALPHA-1` and `ROLE=Prober CODEWORD=BETA-2` (no leakage between sessions), total wall time 27 s for two 20 s waits (parallel). Server log shows both `ask` calls pending at once. No login error, no rate-limit rejection, no 429. Every call carried a `rate_limit_event`: `status: allowed_warning`, `seven_day` utilization 0.51, `five_hour` 0.66 at the start of the spike (the person's plan was already half used; my 18 calls are tiny next to that).

**Confidence:** high for 2 to 4 parallel sessions. Not tested: many sessions for tens of minutes, or real class load.

## (d) Event shape and cost

**Event types seen in stream-json (one JSON per line):** `system/init`, `system/thinking_tokens` (estimates), `assistant`, `user` (carries `tool_result` blocks), `rate_limit_event`, `tool_progress` (heartbeats), `result`. Unisolated runs also add `system/hook_started`, `hook_response`, `commands_changed`, `informational`.

- `init`: `session_id`, `cwd`, `tools`, `mcp_servers [{name,status,source}]`, `model` (resolved full id, e.g. `claude-haiku-5-5`), `permissionMode`, `slash_commands`, `skills`, `plugins`, `agents`, `memory_paths`, `claude_code_version`.
- `assistant.message.content` blocks: `thinking` (text empty, signature only), `text`, `tool_use {id,name,input}`. The adapter's parser already ignores `thinking`. MCP tool names arrive as `mcp__<server>__<tool>`.
- `result`: `subtype`, `is_error`, `result` (text), `num_turns`, `duration_ms`, `duration_api_ms`, `total_cost_usd`, `stop_reason`, `session_id`, `usage {input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens, output_tokens_details.thinking_tokens}`, `modelUsage {<model>: {costUSD, ...}}`, `permission_denials`, `structured_output` (only with `--json-schema`).
- GOTCHA for `src/core/adapter/claude.ts`: it reads `usage.input_tokens`, which was 2 to 8 in every call because nearly all input is cache tokens (`cache_creation_input_tokens` 400 to 37,000, `cache_read_input_tokens` 600 to 5,000). The token counts it reports understate real input by orders of magnitude. Sum the three input fields (or read `modelUsage`) if the Tutor must show tokens.
- Stability: the field names matched across 18 calls on one version. This is the output of a CLI that is not versioned as an API; keep the parser tolerant (it already is).

**Costs (haiku unless stated; tokens: in / cache_create / cache_read / out):**

| What | Call | Cost USD | Tokens | Wall |
|---|---|---|---|---|
| Isolation probe, one answer | 1 | 0.00074 | 2 / 1415 / 0 / 923 (728 thinking) | 9 s |
| Teacher-like turn: predict via `ask`, one fact, `done` (3 model steps) | 2 | 0.00050 | 6 / 1252 / 3546 / 436 | 26 s (20 s was the wait) |
| Same, second sample | 4 | 0.00039 | 6 / 486 / 4315 / 501 | 77 s (70 s wait) |
| Teacher turn that only poses a question and stops | 7 | 0.00018 | 2 / 775 / 594 / 41 | 5 s |
| Extractor-like: 536-word paragraph to JSON with `--json-schema` | 12 | 0.00279 | 2 / 2522 / 0 / 4572 (2597 thinking) | 18 s |
| Auditor-like: 9 propositions, find duplicates | 13 | 0.00050 | 2 / 1088 / 594 / 546 | 4 s |

- Extractor result: 25 propositions and 7 reasoning chains, every chain premise/conclusion names an existing proposition (0 dangling). I did not grade the quality against a human: some propositions are near-duplicates ("Queue_absorbs_bursts" vs "Queue_smooths_load") and one is an example, not a claim ("Shop_example"). That is what the Auditor and merger are for. Output tokens dominate the Extractor cost (more than half are thinking tokens).
- Auditor result: three correct merges (Idempotent_consumers + Idempotency, Dead_letter_queue + DLQ, Work_queue + Competing_consumers); it did NOT merge related-but-different items (Pub_sub_topic, Exactly_once_is_hard). Haiku, sonnet and opus found the same three pairs, but chose different names to keep (haiku kept `Idempotency`, sonnet/opus kept `Idempotent_consumers`). So the "keep" choice is not stable: the deterministic merger must choose the canonical name itself and use the Auditor only for the identity links.
- Prompt-size note: the Extractor input was 536 words because the ticket asked for a 500-word paragraph; all other prompts were under 300 words.

**Extrapolated class cost (estimate, not measured: I did not run a 30-minute class).** About 25 question rounds, about 75 model steps, context growing to 20 to 30k cached tokens: on haiku roughly $0.03 to $0.10, on sonnet roughly 17x that ($0.5 to $1.7), on opus roughly 37x ($1 to $4). Treat as plus or minus 3x; the first real class will tell. End-of-class pipeline for about 3,000 words of Teacher prose: about 6 Extractor chunks x $0.003 = $0.02 and one Auditor call under $0.005 on haiku; sonnet about 17x that (roughly $0.3).

## (e) Resume

**Tried.** Call 7 created a persisted session (no `--no-session-persistence`) with the isolation flags and codeword PELICAN-7. Call 8: `claude -p --output-format stream-json --verbose --resume <id> --model haiku` (no other flags). Call 9: `claude -p ... --continue --model haiku --system-prompt "...codeword is HERON-3" --setting-sources "" --strict-mcp-config --mcp-config mcp.json --disable-slash-commands --tools "" --allowedTools "mcp__tt__*"`.

**Observed.**
- Call 8 (no flags): conversation history survived (the model answered the prediction). The system prompt survived (the model knew it had a secret codeword and refused to say it). Everything else did NOT: the init showed 70+ tools (Bash, Write, Edit, WebFetch, Drive, engram, codebase-memory...), 135 slash commands, 94 skills, the person's plugins (engram, ponytail, caveman, pyright-lsp), the person's user/claudeai MCP servers, and the user's hooks fired. Cost $0.0083, 37,402 cache-creation tokens (the person's whole setup is injected). So the per-session isolation, tool allowance and MCP config are NOT stored in the session.
- Call 9 (`--continue` with all flags again, new system prompt): tools back to only the three MCP tools; history survived; but the model answered with the ORIGINAL codeword PELICAN-7 and ignored HERON-3. `--system-prompt-snapshot` defaults to on: the first system prompt is recorded and reused verbatim on resume, even if a later launch passes different text. `--system-prompt-snapshot off` would change that; untested. Cost $0.0158, 35,730 cache-creation tokens because the transcript now contains the unisolated turn 8.
- `--continue` picked the right session (only one persisted in that cwd). The model also noted its earlier tool list was outdated: it sees the change.
- `--resume`/`--continue` need session persistence on. With `--no-session-persistence` nothing can be resumed. Persisted sessions write transcripts to `~/.claude/projects/<cwd-slug>/`; I deleted the one from this spike.

**Consequence.** Resuming is safe only if every isolation flag, the MCP config, the tool allowlist and the model are passed again, and the role prompt cannot change mid-session. Never resume a session after a run without the flags (the transcript keeps the polluted turn).

**Confidence:** high (two direct observations); one trial each.

## (f) Models

| `--model` | Accepted | Resolved id (init) | Auditor-task cost | Out tokens |
|---|---|---|---|---|
| `haiku` | yes | `claude-haiku-5-5` | $0.00050 (call 13); $0.00034 with full id (cache read 1682) | 546 / 647 |
| `claude-haiku-5-5` (full id) | yes | same | $0.00034 | 647 |
| `sonnet` | yes | `claude-sonnet-5-5` | $0.00865 | 200 |
| `opus` | yes | `claude-opus-5-5` | $0.01857 | 256 |
| `banana` (invalid) | no | n/a | $0; `is_error: true`, text "There's an issue with the selected model (banana)...", stderr `unrecognized_model`, no tokens | 0 |

- All three real models returned the same three merges. Haiku was cheapest by 17x (sonnet) and 37x (opus) on this task, though haiku wrote more output tokens (more thinking). The sonnet/opus runs had no cache hits, haiku sometimes did (cache is shared across sessions with the same prefix), so the true ratio on a warm cache could be larger.
- The adapter already offers `default`, `sonnet`, `opus`, `haiku`. The help text also mentions a `fable` alias; not tested.
- `--fallback-model` exists (untested).

## Tutor-critical behaviours

**1. A question tool that blocks until answered: WORKS WITH CAVEATS.** Works at 20, 70 and 130 s with `MCP_TOOL_TIMEOUT` and `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT` set (the adapter's 30-minute values). Without them it fails at 60 s and the model re-asks (a duplicate card). One pending call for a person who takes 10 minutes is unproven. The model obeyed the "ask once, wait, then one fact" instruction in 3 of 3 runs. Caveat seen in call 5: although told "use only the submit tool", the model used `ask` to put a question to the person; the core must reject questions that are not about a Plan item (already in the spec), and not rely on the prompt.

**2. Arguments rejected with an error the model corrects: WORKS WITH CAVEATS.** Call 6: `submit` with confidence 80 and 55 was rejected (`isError: true`, text with the allowed values); the model read it and called `submit` again with 70 and 50 in the same turn (4 steps, $0.0011). Caveats: (a) it first asked the person how to handle the mismatch, then rounded without a usable answer, so it changed the data silently; (b) in call 5, where the allowed values were written in the tool description, the model never called `submit` and only asked questions. Keep the rule in the tool description AND in the error text, say exactly what to change, and make rejected data impossible to "fix" by guessing (for example an enum in the schema plus an error naming the valid values). The stream shows the rejection as a `user` event with `tool_result` and `is_error: true`.

**3. Instruction that ends the turn after a question: WORKS (1 trial).** Call 7: instruction "write one open question in plain text and END YOUR TURN; do not call tools, do not answer it". Haiku produced 1 step, 41 output tokens, `stop_reason end_turn`, no tools. Not tested: how often a model ignores this (one trial, one model), or harder prompts. If it does not stop (it explains, or calls a tool anyway), what to do: use the blocking `ask` tool instead, because then the model physically cannot go on until the person answers. Ending the turn also forces a resume per answer (section e): every flag repeated, a full context reload per answer, and persisted transcripts. So the blocking tool is the primary design; end-turn is a fallback only.

## Recommended launch recipe per role

Common flags for all four: `-p --output-format stream-json --verbose --setting-sources "" --strict-mcp-config --mcp-config <core mcp config> --disable-slash-commands --tools "" --allowedTools "<only that role's tools>"`, prompt on stdin (the adapter already does this), a neutral empty cwd under aidea's own folder (not the person's project; Tutor reads through core tools), env with the two 30-minute settings (the adapter's `realSpawn` already sets them; the Tutor needs them too). Never `--bare`, never `--dangerously-skip-permissions`. Per-role instructions as a file (`--system-prompt-file`, untested) or inline.

| Role | Tools allowed (MCP tools of the core) | Persistence | Model | Expected cost |
|---|---|---|---|---|
| Prober | ask, plan/probe-hand-over, read project/graph | `--no-session-persistence` (short, 5 questions) | `haiku` for the first version, `sonnet` if the questions are weak | one Probe: about 15 to 20 steps, $0.01 to $0.03 haiku, about $0.2 to $0.5 sonnet (estimate) |
| Teacher | ask, set/revise plan, read project, create Proposal | persistence ON only if crash recovery is wanted; resume needs every flag again | the Tutor model chosen by the person; default `sonnet` | 30-min class: haiku $0.03 to $0.10, sonnet $0.5 to $1.7, opus $1 to $4 (estimates, plus or minus 3x) |
| Extractor | none; use `--json-schema` for the output (adds a `StructuredOutput` tool; read `result.structured_output`) | `--no-session-persistence`, one call per chunk of Teacher prose | `haiku` | about $0.003 per 500 words measured; about $0.02 for a 3,000-word class |
| Auditor | none; JSON of identity links only | `--no-session-persistence` | `haiku` (same 3 merges as sonnet/opus in the one test) | under $0.005 per call measured |

End-of-class pipeline total on haiku: roughly $0.02 to $0.03; on sonnet roughly $0.3 to $0.5 (estimate).

## Things that block the spec

Nothing blocks the design. Items that need a decision or follow-up:

1. **Long wait unproven.** Waits to 130 s work; 30 minutes is not measured. Alternative: put the 30-minute check in the first implementation ticket as a manual script; if it fails, answer the `ask` call early with a "still waiting, re-ask" result, or fall back to end-turn plus resume.
2. **Resume loses isolation.** The spec must say the Teacher is resumed only through the core, always with the full flag set, and that its role prompt is fixed for the life of a session (snapshot). Alternative: avoid resume by keeping one process alive for the whole class (the blocking `ask` allows it).
3. **The model re-asks after a timeout.** A timeout produces a second card. The core should treat a closed connection as withdrawn (already done for permissions) and the prompt should say "if the ask tool fails, do not ask again; end your turn".
4. **Token counts in the adapter understate** (cache tokens not counted). Fix when the Tutor shows usage.
5. **Auditor's choice of canonical name is unstable** across models: let the merger choose.
6. **Email still in model context.** The person's account email reaches isolated sessions (the model reported it). If "no personal information" is a requirement, there is no flag found; accept and document.
7. **Privacy of transcripts.** Persisted sessions land in the person's `~/.claude/projects`, outside aidea's control.

## Calls used: 18 of 20

1. Isolation probe (haiku).
2. Teacher turn, 20 s wait, no env settings.
3. Teacher turn, 70 s wait, no env settings (timed out at 60 s, model re-asked).
4. Teacher turn, 70 s wait, with env settings.
5. Rejection test, first try (model asked instead of calling `submit`; wasted for the test, useful as a finding).
6. Rejection test, second try (tool description without the rule).
7. End-turn-after-question, persisted session.
8. `--resume` with no flags.
9. `--continue` with all flags and a different system prompt.
10. Concurrent session A (Teacher).
11. Concurrent session B (Prober).
12. Extractor-like, `--json-schema`.
13. Auditor-like (haiku).
14. Auditor-like, `sonnet`.
15. Auditor-like, `opus`.
16. Auditor-like, `claude-haiku-5-5`.
17. `--model banana` (rejected at zero tokens, counted anyway).
18. Teacher turn, 130 s wait, with env settings.

## Not tested

- Any wait over 138 s, in particular 30 minutes; which of the two env variables matters alone.
- Each isolation flag on its own; `--safe-mode`, `--restricted`, `--append-system-prompt`, `--system-prompt-file`, `--system-prompt-snapshot off`, `--max-budget-usd`, `--effort`, `--fallback-model`, `--input-format stream-json` (a second way to keep one process and send several user messages, not tried), `--permission-mode` and `--permission-prompt-tool` with the Tutor roles.
- What happens without `--allowedTools` for MCP tools in `-p` mode.
- Stdio MCP servers (HTTP only), and the aidea core's real MCP route (a fake server of the same style was used).
- A real class, a real plan, real project reading tools, and teaching or extraction quality judged by a person.
- Sonnet/opus on the Extractor (only the Auditor task was compared across models), the `fable` alias.
- The behaviour on another machine or OS, or Claude Code versions other than 2.1.312.
- How often the model obeys "end the turn after a question" (one trial).
