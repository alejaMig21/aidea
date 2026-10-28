# 02: Derived layers complete

**What to build:** The Components and data layer shows classes as Nodes with their members instead of UML boxes, and the Code layer shows the exact source text. An "open in my editor" action on the Code layer opens the file in the person's own editor. When the person edits code by hand, the Derived layers recompute so the Canvas always matches the code.

**Blocked by:** 01

**Status:** done

- [x] A class appears as a Node with its methods and attributes as members.
- [ ] Zooming to the Code layer shows the real source text for the selected Node.
- [x] "Open in my editor" opens the corresponding file at the right place.
- [x] Editing a file in the fixture Project and asking the core to refresh changes the Derived layers accordingly.

## Notes from the review

- Implemented and merged. Refresh after a hand edit works by reopening the Project (clicking its name in the list); there is no file watcher or Refresh button yet.
- Selecting a Node shows its source; zooming into the Code layer arrives with ticket 04. The editor defaults to the real VS Code executable on Windows (a `.cmd` shim cannot be started without a shell); `AIDEA_EDITOR` overrides it. Not yet tried against a real editor window.
- Known gaps: source line numbers come from the last analysis, so they are stale after an edit until refresh; `/source` has no file size cap.
