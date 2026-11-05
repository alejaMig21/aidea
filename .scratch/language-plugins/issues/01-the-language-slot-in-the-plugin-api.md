# 01: A language slot in the plugin API

**What to build:** The plugin API gets a slot kind `language`: the file extensions it claims, `analyze` (required), `flow` and `run` (optional), and the capabilities it declares (start a process, read Project files). It is an addition, not a change to what plugins already do; the version rule of plugin-system 09 applies. `docs/plugin-api.md` says so. The registry behind `adapterFor` reads language plugins, and the core's own calls go through it. The slot is designed as the first of a family: project-kind plugins (layer-inference 08) and index providers (layer-inference 10) are slots of the same kind and must fit the same registry without a second mechanism. A fixture language plugin that only analyzes proves it: the Components layer draws what it returns.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] `docs/plugin-api.md` describes the `language` slot and its three operations.
- [ ] A fixture plugin that implements only `analyze` makes the Components layer draw a fixture Project in its language.
- [ ] A plugin that claims an extension another plugin already claims is refused or told to choose, with the reason.
- [ ] A route that needs `flow` or `run` from a plugin that lacks it answers with the same plain-words 422 as today.
- [ ] All existing tests pass; `npm run verify` is green.

Source: `.scratch/language-plugins/spec.md`.
