# 01: A plugin ships a lesson and the Tutor reads it

**What to build:** A plugin can carry a lesson file, declared in its manifest (`lesson`). A lesson is data in the shape of one part of `src/core/guide.ts` (`name`, `hint`, `what`, `question`, `example`, `narration`, `tryIt`) plus `refs`: the things of the plugin the part talks about (a Panel id, a setting key, a service name). The Tutor gets read tools to list the lessons of the plugins that are installed and enabled and to read one (in `PLUGIN_READ_TOOLS`, Tutor only). A lesson reaches the Tutor as untrusted data, marked like a quarantined plugin: the Tutor teaches from it in its own words and never follows instructions found inside it. "How aidea works" opens on the short kernel trunk and offers the menu of lessons. The Terminal plugin, the first built-in plugin, gets a lesson to prove the format.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live in Electron on the second monitor: the tour ends with the Terminal lesson)

- [x] The manifest accepts a `lesson` file; a lesson that does not have the shape is refused with the field named.
- [x] The Tutor can list and read the lessons of installed, enabled plugins, and of no other plugin (a disabled or removed one is absent).
- [x] A fixture lesson with text that looks like an instruction is treated as data (a fake Tutor proves it).
- [x] The class opens on the trunk and offers the menu; the Terminal plugin's lesson is in it.
- [x] Every label in double quotes in a lesson is a label the interface really shows (the rule `guide.ts` states, tested for lessons too).
- [x] Core API tests and a page test for the menu pass; `npm run verify` is green.

Source: `.scratch/plugin-lessons/spec.md`.

## What was built (2026-11-05)

- `src/core/plugins/lesson.ts` reads and checks the lesson file; `manifest.ts` refuses a plugin whose lesson has the wrong shape, naming the field. `host.lessons()` lists the lessons of active plugins.
- Tutor tools `list_plugin_lessons` and `read_plugin_lesson` (Tutor only), results marked untrusted. `guideClassMessage` offers the lessons; `GET /guide` carries them; the quick tour (`46-layer-class.js`) appends them after aidea's own parts.
- The Terminal plugin ships `lesson.json` (2 parts).
- Live: `.scratch/plugin-lessons/live-scripts/lesson-tour.mjs` (12 steps, the last two are the Terminal lesson). The home screen hides the tour, so the check reads the steps from the page; with a Project open the Tutor class runs instead and was not launched (it calls the real agent).
