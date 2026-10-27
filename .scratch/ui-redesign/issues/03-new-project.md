# 03: New project

**What to build:** "New project" on Home asks for a parent folder (using the folder picker) and a name, creates the empty folder and opens it as a Project. Existing names and invalid folder names are refused with a clear message. No templates.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Through the core protocol: creating with a valid parent and name creates the folder, opens it as a Project and records it in the recents.
- [ ] A name that already exists in the parent is refused and nothing is overwritten.
- [ ] A name that is not a valid folder name is refused with a message saying why.
- [ ] A parent that does not exist is refused.
- [ ] Checked live: the Home dialog asks for parent and name and shows the refusal messages.
