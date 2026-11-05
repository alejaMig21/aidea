# Inferring the layers of any project

Status: ticketed (2026-11-05), tickets in `issues/`

Source: the debate of 2026-11-05 with the person, and the blind exam `.scratch/layer-inference-exam/results.md` (two projects, Python).

## Problem

aidea will open projects of three kinds: a blank project, a project of the person, and a project of someone else that the person studies (their examples: a Unity game, the DeepSeek harness repository, a fluid simulator started from zero). The authored layers (Business, Requirements, Architecture) are written today only by the person with the Tutor. Language by language support cannot reach every project, and most projects are not documented.

## What the exam showed

- Architecture can be inferred from code alone, in about a dozen reads.
- From code alone, Requirements recover what the program does, not why: its rules and decisions are not in the code.
- Business inferred from a name and leftover files misled once, with a wrong and accusing guess.
- Git history is needed to tell live code from legacy.

## Decisions (agreed with the person)

1. **The three layers always exist**, whatever the kind of project. What changes is who fills them and how each item is marked.
2. **Blank or own project:** the person is the source of intent. The Tutor asks and co-authors, as today.
3. **Project of someone else:** nobody present knows the intent, so the Tutor does not ask about requirements or business. It builds the three layers itself from the code and the project's own documents, marks every item observed, inferred or unknown, and asks only for the person's learning goal ("I want to build my own harness"), which decides what to build in detail. These layers are study notes, not a Contract for the Builder.
4. **Every claim cites evidence** (files and lines). The core refuses a Proposal whose citations do not exist or do not say what is claimed.
5. **Business is never stated as a hypothesis about purpose that could read as an accusation.** Where the code does not say, the item says "unknown" and why.
6. **The Tutor reads a chosen few files**, not all: entry points, most-called modules, most-changed files, tests.
7. **Several passes**: Architecture first, then Requirements per surface, then Business, then a pass that looks for evidence against each claim.
8. **The person accepts each Proposal**; the Tutor never writes a layer directly.
9. **Opening never waits.** A Project opens at once with its fingerprint and an overview by folder; the analysis and any index run in the background, are cached outside the Project, and fill the layers in as they finish. A huge Project must not block the window. (The speed of the analysis itself is big-projects 01; the drawing speed, big-projects 02.)

## Architecture: facts from tools, patterns from judgement, checked by the core

The Architecture layer is drawn as a whiteboard of boxes, relations and architectural patterns, not as a dump of the code graph. It takes three steps:

1. **Facts** (from aidea's own analysis or an index provider such as Codebase Memory): packages, which package calls which and how often, direction of dependencies, cycles, entry points. These are evidence, cheap and objective. An index does not name patterns: its own "layers" are a heuristic by fan-in.
2. **Judgement** (the Tutor): groups modules into boxes with names a person would draw, recognises the pattern (layered, hexagonal, event-driven, plugin-based...), and proposes the Nodes and a Pattern group with a role for each box (ticket tutor 14), with the evidence.
3. **Check** (the core, no model): the rules of the pattern are tested against the real relationships. For hexagonal, no domain module imports an adapter; for layered, no dependency goes upward. A violation shows as a Difference of type pattern (it exists today). A pattern the Tutor claimed that the code contradicts is reported, not drawn as fact.

## Layers of support (what works for which project)

1. **Fingerprint** (any project, seconds): file tree, manifests, entry points, git history, documents that exist.
2. **Structural index** (any language the provider knows, in the background, cached outside the Project): modules, symbols, imports, calls, approximate.
3. **Precision plugins** (a language plugin, where it exists): resolved calls, flow, Playback.
4. **Domain lenses** (a plugin that understands a kind of project, not a language): for Unity, scenes, prefabs and ScriptableObjects.

The index provider is replaceable (Codebase Memory first; an own tree-sitter on WebAssembly later). The index chooses what the Tutor reads; it is not the source of intent.

## Not here

- The index provider itself and the speed of opening (big-projects).
- Plugins of language and their API (language-plugins).
- Scoring the person.

## Open

- The exam with the aidea Tutor and its tools, a repeat run, the DeepSeek repository (it could not be downloaded) and a project that is not in Python.
- How the learning goal is asked and kept for a studied project.
