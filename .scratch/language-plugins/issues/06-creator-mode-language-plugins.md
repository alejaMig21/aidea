# 06: Creator Mode can write a language plugin

**What to build:** The plugin template gets a language variant and the Creator Mode skill a section for language plugins: write `analyze` first and stop there if that is all that is needed; add `flow`, then `run`, only when asked. A fixture proves it: the Builder, driven by a fake agent, writes a tiny analyze-only plugin for a made-up language, and it passes the scan and installs.

**Blocked by:** language-plugins 01, roles-and-contract 03, plugin-teaching 04.

**Status:** ready-for-agent

- [ ] The language template, copied unchanged, passes the scan and installs.
- [ ] The skill says to start with `analyze` and to declare the capabilities honestly.
- [ ] A fake Builder writes an analyze-only plugin for a made-up language that makes the Components layer draw a fixture Project.
- [ ] The scan blocks a language plugin that starts a process it did not declare.
