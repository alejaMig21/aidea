# 03: New project

**What to build:** "New project" on Home asks for a parent folder (using the folder picker) and a name, creates the empty folder and opens it as a Project. Existing names and invalid folder names are refused with a clear message. No templates.

**Blocked by:** 02

**Status:** ready-for-agent

- [x] Through the core protocol: creating with a valid parent and name creates the folder, opens it as a Project and records it in the recents.
- [x] A name that already exists in the parent is refused and nothing is overwritten.
- [x] A name that is not a valid folder name is refused with a message saying why.
- [x] A parent that does not exist is refused.
- [ ] Checked live: the Home dialog asks for parent and name and shows the refusal messages.

## Review notes

Automated (`test/new-project.test.ts`, via `POST /projects/new {parent, name}`): creation + recents, existing name/file not overwritten, 19 invalid names (empty, blank, `../x`, `a/b`, `a\b`, `..`, `.`, `con`, `NUL.txt`, `: * " < | ?`, trailing dot/space, non-string, missing), missing/non-directory/absent parent.

Needs the live check (not run, no real window): the "New project" button toggles the inline form on Home; "Choose..." appears only in the desktop shell and fills the parent from the picker; typed parent works in a browser; refusal messages show under the form; success hides Home and draws the new (empty) Project. Edits are confined to `src/ui/features/05-home.js` and the Home section of `src/ui/index.html`.
