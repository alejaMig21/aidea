# 04: Creator Mode writes the lesson with the plugin and keeps it current

**What to build:** The plugin template carries an empty lesson. The Creator Mode skill says to write the lesson together with the plugin and to update it every time the plugin changes, and to run the check of ticket 03. A plugin the Builder wrote cannot be proposed for installing without a valid lesson. A plugin from anywhere else is never refused for lacking one.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser)

- [x] The template, copied unchanged, still passes the scan and installs, and its lesson is a valid empty one.
- [x] The skill document tells the agent to write and update the lesson.
- [x] A Builder-written plugin without a valid lesson is not proposed; the reason is shown in plain words.
- [x] A third-party plugin without a lesson installs with a warning only.
- [x] Core API tests with a fake Builder pass.

## What was built (2026-11-05)

- `propose_plugin` (`routes/mcp.ts`) refuses a Builder-written plugin whose manifest is valid but has no `lesson` ("A plugin you write must come with a lesson that teaches it ... add a lesson.json (copy it from docs/plugin-template)") and one whose lesson is not valid (the problems named). The folder never reaches the quarantine. A plugin from anywhere else (`POST /plugins/quarantine`, a person) is never refused: the scan only warns (plugin-lessons 03).
- The template (`docs/plugin-template`) now has `lesson.json` (one placeholder part) named in its manifest; copied unchanged it scans with no blocking finding and no lesson warning.
- The skill (`docs/plugin-skill.md`): new step 6 "Write the lesson with the plugin": what the file is, plain words, quoted labels must be real, what `refs` may name, update it every time the plugin changes and read the scan.
- Tests: `test/plugin-builder-lesson.test.ts` (4); `plugins-builder.test.ts` now writes a lesson with each fixture plugin.
- Live (main monitor, the person's browser, `serve-fake-builder.mjs`): a stand-in Builder proposed two folders from the Builder panel: "nolesson: REFUSED. A plugin you write must come with a lesson ..." and "withlesson: PROPOSED", and only the second is in the quarantine; no page errors.
