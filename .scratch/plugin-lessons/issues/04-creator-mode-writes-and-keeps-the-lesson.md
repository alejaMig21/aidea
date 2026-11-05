# 04: Creator Mode writes the lesson with the plugin and keeps it current

**What to build:** The plugin template carries an empty lesson. The Creator Mode skill says to write the lesson together with the plugin and to update it every time the plugin changes, and to run the check of ticket 03. A plugin the Builder wrote cannot be proposed for installing without a valid lesson. A plugin from anywhere else is never refused for lacking one.

**Blocked by:** plugin-lessons 03.

**Status:** ready-for-agent

- [ ] The template, copied unchanged, still passes the scan and installs, and its lesson is a valid empty one.
- [ ] The skill document tells the agent to write and update the lesson.
- [ ] A Builder-written plugin without a valid lesson is not proposed; the reason is shown in plain words.
- [ ] A third-party plugin without a lesson installs with a warning only.
- [ ] Core API tests with a fake Builder pass.
