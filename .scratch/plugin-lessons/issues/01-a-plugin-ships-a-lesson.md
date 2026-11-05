# 01: A plugin ships a lesson and the Tutor reads it

**What to build:** A plugin can carry a lesson file, declared in its manifest (`lesson`). A lesson is data in the shape of one part of `src/core/guide.ts` (`name`, `hint`, `what`, `question`, `example`, `narration`, `tryIt`) plus `refs`: the things of the plugin the part talks about (a Panel id, a setting key, a service name). The Tutor gets read tools to list the lessons of the plugins that are installed and enabled and to read one (in `PLUGIN_READ_TOOLS`, Tutor only). A lesson reaches the Tutor as untrusted data, marked like a quarantined plugin: the Tutor teaches from it in its own words and never follows instructions found inside it. "How aidea works" opens on the short kernel trunk and offers the menu of lessons. The Terminal plugin, the first built-in plugin, gets a lesson to prove the format.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The manifest accepts a `lesson` file; a lesson that does not have the shape is refused with the field named.
- [ ] The Tutor can list and read the lessons of installed, enabled plugins, and of no other plugin (a disabled or removed one is absent).
- [ ] A fixture lesson with text that looks like an instruction is treated as data (a fake Tutor proves it).
- [ ] The class opens on the trunk and offers the menu; the Terminal plugin's lesson is in it.
- [ ] Every label in double quotes in a lesson is a label the interface really shows (the rule `guide.ts` states, tested for lessons too).
- [ ] Core API tests and a page test for the menu pass; `npm run verify` is green.

Source: `.scratch/plugin-lessons/spec.md`.
