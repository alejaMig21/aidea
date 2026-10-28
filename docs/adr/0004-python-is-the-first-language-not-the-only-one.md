# Python is the first supported language, not the only one

aidea's derived layers (Components, Algorithms) and Playback work on Python projects only today. That was a choice of simplicity: ADR 0002 requires the first language to have strong static-analysis tooling. It is not a design goal. aidea is meant to be the owner's workstation for websites, games, desktop and mobile apps, and it must be able to run on its own code, which is TypeScript and plain JavaScript.

The direction, not yet scheduled: put the Python-specific work behind a language adapter with three operations (analyse a project into modules, classes, functions and relationships with their Resolution; build the flow graph of one function; run one function with test data and return its path), the same way the Agent adapter hides Claude Code. Python becomes the first adapter and TypeScript/JavaScript the second, because it is the one that lets aidea run on aidea.

## Where Python is coupled today

- Five scripts next to `src/core/` (`analyze.py`, `flow.py`, `relations.py`, `effects.py`, `playback.py`, about 1150 lines), called only through `python.ts` from three routes (`projects.ts`, `algorithm.ts`, `playback.ts`). Everything else works on the JSON they return.
- Interface text that names Python: the Components and Playback legends and notes, and the path field of the Home screen.

## Open points for when this is scheduled

- Analysis tooling per language: the TypeScript compiler API for TS/JS, Language Server Protocol servers for many languages with less detail, tree-sitter for structure only. Running code is per language and the costliest part.
- A project with several languages: each file goes to its adapter; links between languages are marked uncertain.
- Running aidea's own code inside aidea: the Playback guards are a safety net, not a sandbox, so this needs its own decision.
- Until then, text that is not about a Python-specific fact should not say "Python".
