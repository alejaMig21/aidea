# 06: Creator Mode can write a language plugin

**What to build:** The plugin template gets a language variant and the Creator Mode skill a section for language plugins: write `analyze` first and stop there if that is all that is needed; add `flow`, then `run`, only when asked. A fixture proves it: the Builder, driven by a fake agent, writes a tiny analyze-only plugin for a made-up language, and it passes the scan and installs.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser)

- [x] The language template, copied unchanged, passes the scan and installs.
- [x] The skill says to start with `analyze` and to declare the capabilities honestly.
- [x] A fake Builder writes an analyze-only plugin for a made-up language that makes the Components layer draw a fixture Project.
- [x] The scan blocks a language plugin that starts a process it did not declare.

## What was built (2026-11-05)

- `docs/plugin-template-language/`: a working analyze-only language plugin (manifest with `language`, `capabilities: ["files"]` and a lesson; `main.js` draws one module per file of the extension; `lesson.json`). Copied unchanged it scans with no blocking finding and no lesson warning.
- The skill (`docs/plugin-skill.md`) has a section "Language plugins": copy that template; analyze first and stop there if that is all that is needed; `flow`, then `run`, only when asked, in that order; change id, label, extensions and the constant together; declare capabilities honestly (`"files"` to read, `"processes"` for any program it starts); running code is the plugin's own responsibility and its lesson says so.
- Tests (`test/language-template.test.ts`, 4): the template scans clean; the skill section exists; a fake Builder copies the template for a made-up language, changes the id and extension, proposes it, it installs (status `applied`) and opening a Project with `.zed` files draws them next to the Python and JavaScript nodes; the scan blocks a language plugin that starts a process it did not declare and accepts it once declared.
- Live (main monitor, the person's browser, `serve-fake-language-builder.mjs`): sending a message made the stand-in Builder copy the template and propose it; installing it from the Plugins manager and reopening the Project changed the line from nothing to `Analysed: Zed language, 2 files; JavaScript, 1 file.` and drew the two Zed modules; no page errors.
