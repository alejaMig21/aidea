# 03: A mechanical check that a lesson still names what its plugin has

**What to build:** Each `refs` entry of a lesson is compared with what the live inspection (`GET /plugins/inspect`) says the plugin declares. A ref that no longer exists is a finding: "the lesson names X, the plugin no longer has it". The finding is a warning, never a block. It shows in the quarantine report, when the plugin loads, and in the update difference, where it also says "the plugin changed, the lesson did not". The check proves only that the names exist, not that the prose is right.

**Blocked by:** None (can start immediately).

**Status:** resolved 2026-11-05 (live on the main monitor in the browser)

- [x] A fixture plugin whose lesson names a missing Panel produces the warning in the quarantine report and at load.
- [x] An update that changes the plugin but not the lesson shows "the plugin changed, the lesson did not" in the difference.
- [x] A plugin without a lesson gets a warning, not a block.
- [x] Core API tests pass.

## What was built (2026-11-05)

- `src/core/plugins/lesson-refs.ts`: what a `refs` entry may name and how it is looked up in what the plugin declares: the plugin id, `view`, `panel:<id>` (the interface file writes an entry with that id), `setting:<key>`, `service:<key>`, `event:<name>`, `check:<name>`, `capability:<name>`. A name the plugin no longer has, or one aidea cannot check, is a `lesson-stale` warning ("the lesson names X, the plugin no longer has it"); it never blocks.
- The scan adds it to the quarantine report; a plugin with no lesson gets a `no-lesson` warning ("the Tutor cannot teach it"); at load the warnings go to the plugin log (`host.logs()`); `difference()` returns `lessonStale` when some file other than the lesson changed and the lesson did not, and the manager says "The plugin changed, the lesson did not." on the update line.
- The check proves only that the names exist, never that the prose is right.
- Tests: `test/plugin-lesson-refs.test.ts` (5). Live (main monitor, the person's browser, `serve-stale-lesson.mjs`): the Plugins manager shows `the lesson names "setting:volume", the plugin no longer has it` and `this plugin ships no lesson, so the Tutor cannot teach it` for two plugins in the quarantine; no page errors. The update line was tested in the core, not seen in the window.
