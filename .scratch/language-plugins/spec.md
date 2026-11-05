# Languages as plugins

Status: draft, waiting for the person's read (then `/to-tickets`)

Source: ADR 0008 (decision 2 lists "language adapters" among the plugins), ADR 0004 (language adapters behind one interface), `src/core/adapters.ts`, the plugin system tickets, and the person's answers of 2026-11-04: languages should be plugins; Python is the default language; a developer who wants R asks the Builder in Creator Mode for an R plugin, and in a better future downloads one already written.

## Problem

The two language adapters, Python and TypeScript/JavaScript, live inside the core (`python-adapter.ts`, `typescript-adapter.ts`) and the core assumes them. ADR 0008 says they are plugins, but the plugin API has no place for one. A language nobody wrote an adapter for cannot be added without changing aidea itself, and the open question of how to run JavaScript safely (language-adapters 05) has no natural owner.

## Solution

A language is a plugin that fills a "language" slot with the three operations aidea already has: `analyze` (required), `flow` and `run` (optional). Python ships with aidea as a plugin that is on by default. TypeScript and JavaScript ship the same way. Any other language comes from a plugin the Builder writes in Creator Mode, or, later, one downloaded from somewhere. The core stops knowing the names of languages; it asks the registry.

## Decisions (agreed with the person unless marked)

1. **Python is the default language, not a required one.** It ships with aidea and is on by default. It can be turned off or removed like any plugin that ships with aidea. (The only required plugin stays the agent adapter, and the emergency screen and plugin manager are kernel.)
2. **Other languages are plugins**, written with Creator Mode or downloaded. A downloaded language plugin goes through the quarantine and scan like any other.
3. **A plugin may offer only `analyze`.** That is a complete, useful language plugin (the Components layer works); `flow` and `run` can come later. The Creator Mode skill says to write them in that order.
4. **aidea with no language plugin still works** for the layers the person writes (Business, Requirements, Architecture). Components, Flow, Data and Playback say in plain words that no plugin reads the language of this Project, name the languages found, and offer "Ask the Builder for a plugin for R". (Today a language with no adapter already appears as not analysed; this makes the message and the offer explicit.)
5. **TypeScript and JavaScript ship with aidea, on by default, as a plugin** (the agent's proposal, because aidea reads its own repository: real-projects 02). The person can turn it off.
6. **The language plugin owns the safety of running that language.** It declares the capability to start a process and to read Project files; the scan shows it; the person confirms it at install. Playback's rule stays: blocking is a safety net, not a sandbox, and the screen says so.
7. **The recording of values is the shared contract.** What a `run` returns (steps, values on arrival, the shapes of ticket 13 in layout-and-data) is defined by the core, so Flow and Data draw any language the same way.
8. **Each language plugin ships a lesson** (plugin-lessons): what it reads, what it can run, what it blocks.

## What the plugin API gets

A slot kind `language` with: the file extensions it claims, `analyze`, optional `flow`, optional `run`, and the declared capabilities. An addition to the API, not a change to what plugins already do; the version rule of plugin-system 09 applies. A plugin may ship files other than JavaScript (the Python adapter has `analyze.py` and `playback.py`); the scan reads them like the rest.

## Suggested slices (tracer bullets, in order)

1. The `language` slot in the API and in `docs/plugin-api.md`; the registry reads language plugins; the core's own calls to `adapterFor` go through it. A fixture language plugin proves it (analyze only).
2. Python moves into a built-in plugin. Behaviour and every existing test unchanged.
3. TypeScript and JavaScript move the same way.
4. No language plugin: the plain message and the offer to ask the Builder (decision 4).
5. Creator Mode: a template and a skill section for language plugins (analyze first, then flow, then run).
6. language-adapters 05 (how to run JavaScript safely) is decided inside the TypeScript plugin, with the person's answer.

## Not here

- A catalogue or any way to search for and download plugins. Only the quarantine path that exists.
- The R plugin itself.
- Changing the shapes recorded for values (layout-and-data 13).

## Open

- How the TypeScript compiler library travels with the TypeScript plugin (a plugin is a finished folder; the library is large).
- Whether a Project with several languages shows one Components layer or one per language (today one, mixed).
