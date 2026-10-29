# 06: The person chooses which editor Open in my editor uses

**What to build:** User story 23. The editor is set only by an environment variable and assumes the go-to-line syntax of one editor. Add a setting in the interface with the common editors and their go-to-line arguments.

**Blocked by:** None (can start immediately).

**Status:** done (go-to-line syntaxes are unverified against each editor's docs; see src/core/editors.ts)

- [x] Choosing each listed editor builds its correct command line (tested without launching it); the choice is saved; an unknown editor can be typed with a template; failing to launch says so in words.
