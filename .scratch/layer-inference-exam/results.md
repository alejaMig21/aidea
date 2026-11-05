# Blind exam: inferring the three authored layers from code with no documentation

Run on 2026-11-05 for the debate "how aidea infers the layers of any project" (backlog row "Infer the layers of ANY project"). Method: for each project, a copy of its tracked files without any documentation (markdown, `docs/`, README, CLAUDE, GLOSSARY, ROADMAP, `.claude`, handoffs; no git history), about 12 targeted reads (manifest, example config, folder trees, entry points, docstrings, test names, sample data), then Architecture, Requirements and Business written with an evidence tag on every claim (O observed, I inferred, U unknown), and only after that compared with the documentation that was removed. The agent was Claude (this session's model), not the aidea Tutor, and used file reads, not a code-graph tool. The inferred layers are in `telegram.inferred.md` and `hubstaff.inferred.md` next to this file.

Limits to keep in mind: two projects of one person, both Python, both written with heavy documentation habits; the exam author is also the one who wrote the rules the exam checks; one run each, no repetition; contamination happened once (see hubstaff).

## Telegram (termgram: a terminal Telegram client with an optional MCP server)

| Layer | Result |
|---|---|
| Architecture | Right on every structural claim: hexagonal (ports and a Telethon and a TDLib adapter), domain with an event bus, UI on top, resumable download engine with SQLite, config loader, optional MCP server that reuses domain and adapters. Missed: that `app.py` is the composition root and that one `UIBridge` is the only translator from events to the UI. |
| Requirements | All 7 capabilities the README lists were found (login by QR, chat navigation, messaging, bots, resumable downloads, connection resilience, configuration), with criteria taken from tests (config precedence, bandwidth cap, resume from zero, day separators). Missed: forwarding, fuzzy filter, logout, keyboard bindings. Found 5 real features the README does not mention (polls, notification rules, DeepL translation, message search, profile panels). No false requirement. |
| Business | Value proposition and segments matched what the README says and implies (terminal users, networks that filter Telegram, AI-agent automation). Revenue and channels marked unknown, which is true. Nothing contradicted. |

## hubstaff-automation (the README calls it "Home Processor": a Windows bot that learns apps instead of being told about them, with no model at runtime)

| Layer | Result |
|---|---|
| Architecture | Mostly right: hexagonal vision core (domain, ports, adapters, orchestrators), a curiosity loop that only hovers, a persistent map of an app's screens and transitions, a run controller with pause, resume and cancel, a privacy-preserving recorder, a terminal front end in the Elm style, an MCP server with read-only, plan-only and one acting `confirm` tool. Missed the idea that organises all of it: a "director" (an agent or person) teaches and the bot measures effects, plus the redaction barrier and the rule that nothing is learned without N agreeing runs. |
| Requirements | Found about 7 of the 29 numbered requirements of the product definition (TUI, MCP server, human-like pointer, flow control with branches and visit limits, privacy and fail-closed, pause and cancel, benchmarks). Missed most of the rules that are decisions and not behaviour: no model at runtime, ask before studying an unknown app, one map per app and version, preview before an irreversible step, the user logs in by hand, redaction. No false requirement, but the first one (workdays of document writing and navigation) describes a legacy part. |
| Business | WRONG where it mattered. The name "hubstaff" plus shuffled workday data with erratic mouse curves led to a low-confidence hypothesis that the program produces plausible activity for a time-tracking tool. The documentation says Hubstaff "was only the origin of the project" and that the Hubstaff-era configuration was retired; the product is an assistant that learns to operate any Windows app. The hypothesis was marked low and turned into questions, which limited the harm, but it is the kind of sentence a Tutor must never say to a person about their own work. |

Contamination: `openspec/config.yaml` stayed in the blind copy and describes the product; it was read before it was noticed. The sentences that rest on it are marked in the inferred file and do not count for the score.

## What the exam says about the design

1. **Architecture can be inferred well from code alone**, in a dozen reads, in Python at least. The structure is in the code.
2. **Requirements: behaviour is recoverable, decisions are not.** What the program does shows in surfaces and tests; why it refuses things, what it will never do, and its governing principles live in interviews and design documents. The honest output is a list of behaviours with evidence plus a list of questions about rules, not a claim to know the rules.
3. **Business is where simulated judgement is dangerous.** Names and leftover files mislead. The Tutor must state Business as questions to the person, and a hypothesis about purpose that could read as an accusation must not be stated at all.
4. **Recency matters and was removed on purpose.** The legacy Hubstaff data was still in the tree; the git history (what changed lately, what was retired) would have separated live code from leftovers. The exam hid history to be conservative and paid for it. The design should use it: churn, last-modified dates and "retired" commits.
5. **A leak of any documentation-like file in a config (an `openspec/config.yaml`, a `description` field) is evidence the Tutor should use and say it used**, but an exam must strip it.
6. **Cost:** about 12 reads per project were enough for the structure; a code index would mainly help choose those reads in a project with thousands of files, which neither of these two is.

## Not done

- The third project, the DeepSeek harness repository (TypeScript, not Python, documented by others): the clone was still downloading when this was written; its result is added below if it finished.
- A repeated run to see how much the result varies.
- The same exam with the aidea Tutor and its tools instead of this agent.
- A Unity project (the person's `ShipsProject`): the scenes and prefabs are not understood by any index tested, so it needs its own lens before an exam means anything.
