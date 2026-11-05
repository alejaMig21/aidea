# Inferred layers: hubstaff-automation (blind: no README, docs or markdown)

CONTAMINATION, disclosed: the blind copy still held `openspec/config.yaml`, whose `context:` field describes the product ("a general task automation bot ... workdays are graphs of tasks; tasks are scenario graphs of steps ... hexagonal core in src/vision"). It was read before it was noticed. Claims marked [LEAK] below rest on it; everything else was derived from other files. Evidence read: `pyproject.toml`, `main.py`, the tree of `src/` (about 90 modules), `scripts/` (27 names), docstrings of five modules (`assistant_api/tools.py`, `trial_recorder/recorder.py`, `vision_pilot/loop.py`, `run_control/controller.py`, `vision/domain/app_map.py`), a scenario file, a workday template and a batch file. About 12 reads. Status: O observed, I inferred, U unknown.

## Architecture

- **A Windows desktop automation program in Python 3.12** [O: `pywinauto`, `pywin32`, `winrt-*` OCR, `pynput`]. Entry point `main.py WORKDAY_FILE` runs a workday through `scripts/probe.py run` [O].
- **vision (hexagonal core)**: `domain` (AppMap, action trace, agreement, appearance, delta...), `ports.py`, `adapters` (UI Automation, OCR, screen capture, keyboard and physical click, a Florence-2 and OmniParser captioner, an Ollama vision model, Windows app catalog, pty terminal), `orchestrators` [O; "hexagonal" also [LEAK]]. Models are optional dependency groups (CPU torch, GPU torch, omniparser) [O: pyproject].
- **vision_pilot**: a curiosity loop that looks at the screen (eye), moves the pointer over candidates (hand, hover only) and remembers what it learned in a ledger; it never probes outside a region and fails closed [O: `loop.py` docstring].
- **action_catalog**: a store and compiler of named actions and bundles [O].
- **run_control**: a pause, resume and cancel state machine with hotkeys and a queue, checked between steps [O].
- **trial_recorder**: records privacy-preserving trial data (counts, hashes, closed vocabulary; never titles, typed text or paths) for studies and learning [O: docstring].
- **tui_app**: a terminal front end in the Elm style (state, update, view, effects) [O: file names].
- **assistant_api and agent_tooling**: an MCP server (`fastmcp`) with three safety classes: read-only tools, plan-only tools, and a single acting tool `confirm(plan_id)` that is one-shot, expiring and tied to its plan; text that comes from the machine is fenced as untrusted [O: `tools.py` docstring].
- **Data**: JSON workdays (a graph of batches by `$ref`), batches of actions (mouse move, visit URL, type text, open documents), scenario graphs of steps (`launch`, `expect_text`, `press`, `snapshot`, `done`) [O: `data/`, `examples/`].
- Relations: main -> probe script -> run control -> vision orchestrators -> adapters -> the OS; assistant_api -> the same run and catalog services [I].

## Requirements (functional)

1. As an operator, I run a workday file: a total duration and an ordered or shuffled set of batches of actions (Claude Desktop use, writing a Word document, writing a text file, web navigation). [O: `workday_principal.json`, batch files.]
2. As an operator, the pointer moves like a person: curved, erratic paths and variable duration. [O: `bezier.py`, `erratic_curvature`, `duration_ms`.]
3. As an operator, I pause, resume or cancel a run at any time, including by hotkey. [O: `run_control`.]
4. As a tester, I describe the steps for a terminal application as a graph (launch, expect text with a timeout, press a key, branch on success or failure with a visit limit, take a snapshot) and run it. [O: `examples/scenarios/demo_pass.json`, `max_visits`.]
5. As an operator, the program explores an unknown app: it studies an unknown app by looking at it and builds a map of its screens and transitions that later runs reuse, with a rule that "rejected" knowledge always wins and use-mode knowledge never carries destructive meaning. [O: `app_map.py`, `vision_pilot`.]
6. As a developer, I measure how well the program recognises screens and picks actions with benchmarks and fault injection. [O: `scripts/bench_*`, `vision_eval.py`, `fault_injection*.py`.]
7. As someone with an AI assistant, I let it inspect and plan work through an MCP server, and only a `confirm` call acts. [O.]
- Non-functional: privacy (no screen text, titles or typed text in logs or records) [O: three docstrings]; fail closed [O]; runs on CPU, optional GPU [O: dependency groups]; Windows 10 or 11 only [I: `pywin32`, `winrt`].

## Business

- **What it is for (I, medium; [LEAK] for "general task automation"):** automating computer work on Windows by looking at the screen, with a human-like hand.
- **Why the name matters (I, low; the code does not say):** "hubstaff" is a time-tracking product that records activity (input, applications, screenshots). A program that runs shuffled workdays of mouse movement, document writing and browsing for a set number of minutes looks built to produce plausible activity. The code never says what for.
- **Customer segments, channels, revenue (U):** a PyInstaller spec and an installer folder exist (`installer/`), so it is meant to be handed to someone [I, low]. No licence text other than third-party, no billing, no plans.
- **Questions for the person:** What is the real purpose of a workday run? Who runs it, you or others? Is it meant to be distributed, and to whom?
