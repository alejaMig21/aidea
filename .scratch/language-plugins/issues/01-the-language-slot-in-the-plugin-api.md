# 01: A language slot in the plugin API

**What to build:** The plugin API gets a slot kind `language`: the file extensions it claims, `analyze` (required), `flow` and `run` (optional), and the capabilities it declares (start a process, read Project files). It is an addition, not a change to what plugins already do; the version rule of plugin-system 09 applies. `docs/plugin-api.md` says so. The registry behind `adapterFor` reads language plugins, and the core's own calls go through it. The slot is designed as the first of a family: project-kind plugins (layer-inference 08) and index providers (layer-inference 10) are slots of the same kind and must fit the same registry without a second mechanism. A fixture language plugin that only analyzes proves it: the Components layer draws what it returns.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live in Electron on the second monitor: a plugin that only analyzes a made-up language draws its Nodes in Components)

- [x] `docs/plugin-api.md` describes the `language` slot and its three operations.
- [x] A fixture plugin that implements only `analyze` makes the Components layer draw a fixture Project in its language.
- [x] A plugin that claims an extension another plugin already claims is refused or told to choose, with the reason.
- [x] A route that needs `flow` or `run` from a plugin that lacks it answers with the same plain-words 422 as today.
- [x] All existing tests pass; `npm run verify` is green.

Source: `.scratch/language-plugins/spec.md`.

## What was built (2026-11-05)

- Manifest `language` = `{ id, label, extensions }` (`manifest.ts`, `languageProblems`). The host half gives its adapter once with `ctx.languages.provide(adapter)` (`host.ts`); the plugin fails to activate if it did not declare `language`, provides twice, or gives an adapter without `analyze`.
- The registry: `registerLanguage` in `adapters.ts` and `addLanguage` in `languages.ts` add and remove the language and its adapter together, so `adapterFor`, `detectLanguages` and the file tree read plugin languages like the built-in ones. A claimed id or extension (case-insensitive) is refused naming who holds it.
- `flow` and `run` missing: the routes' existing plain-words 422 (tested). `docs/plugin-api.md` has "The language slot"; `inspect` lists the slot and the new manifest fields (`lesson`, `teach`, `language`).
- Live: `.scratch/language-plugins/live-scripts/language-slot.mjs` (Zed plugin in the plugin store; opening a folder of .zz files shows "Analysed: Zed, 1 file." and draws app, Shop and checkout()).
- The slot is the first of a family: project kinds (layer-inference 08) and index providers (layer-inference 10) can add their own declared field and `ctx` method the same way.
