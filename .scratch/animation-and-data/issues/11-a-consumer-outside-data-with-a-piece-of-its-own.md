# 11: A consumer outside Data, with a piece of its own

**What to build:** The fourth delivery, the proof that the engine is general (spec decisions 2, 3 and 5). A plugin that is not Data and has no function to run hands the engine a recording of its own and registers a piece of its own: a fixture that draws branches in lanes (the shape the git graph needs). Nothing in the engine changes to make it work; if something has to, the engine was not general enough and that is fixed here, in the engine. It also writes the care for the git graph (`vg`): a plugin whose steps are many (tens of thousands of commits) cuts them itself and notes how many are missing.

**Blocked by:** animation-and-data 10.

**Status:** ready-for-agent

- [ ] A fixture plugin with its own piece and its own recording is drawn by the engine, animated between steps, with its text form and its image.
- [ ] The plugin's piece is removed with the plugin.
- [ ] A recording with more elements than the plugin shows is drawn with the engine's note "... and N more".
- [ ] `docs/plugin-api.md` describes how a plugin hands a recording and registers a piece, with this fixture as the example.
- [ ] Core API and page tests pass; `npm run verify` is green.

Source: `.scratch/animation-and-data/spec.md`; `.scratch/versions` (the git graph this proves).
