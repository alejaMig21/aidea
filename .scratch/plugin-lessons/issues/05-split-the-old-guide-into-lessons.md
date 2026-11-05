# 05: The old guide is split: the kernel trunk and one lesson per plugin

**What to build:** `src/core/guide.ts` keeps only what the kernel owns (the first look, the Builder, the Canvas and layers, Proposals, the Plan and the Contract, Differences). Parts that describe something a plugin owns (Playback and Run, the Terminal, Files, Code, the Tutor's sections) move into the lessons of the built-in plugins that own them. Which parts are the kernel's and which a plugin's is decided in this ticket with the person. This is where the live check of aidea-guide 01 is finally run, with the real Claude Code: the class teaches something correct and invents no feature.

**Blocked by:** plugin-lessons 02, roles-and-contract 04.

**Status:** needs-info: the person decides which parts belong to the trunk and which to a plugin

- [ ] The trunk lists only kernel parts; each moved part exists in the lesson of the plugin that owns it; no part is lost.
- [ ] With a built-in plugin turned off, its lesson is not offered.
- [ ] The test that checks every quoted label against the interface passes for the trunk and the lessons.
- [ ] Verified live with the real Claude Code, in Vivaldi: the class teaches something correct about the app and does not invent features (the last box of aidea-guide 01).
